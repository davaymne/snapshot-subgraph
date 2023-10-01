import {TypeormDatabase} from '@subsquid/typeorm-store'
import {Delegation, Block, Sig} from './model'
import {processor} from './processor'
import * as DelegateRegistry from "./abi/DelegateRegistry";
import * as GnosisSafe from "./abi/GnosisSafe";
import { time } from 'console';

processor.run(new TypeormDatabase({supportHotBlocks: true}), async (ctx) => {
    const sigs: Sig[] = []
    const delegationsSet: Map<string, Delegation> = new Map()
    const delegationsClear: string[] = []
    for (let c of ctx.blocks) {
        await ctx.store.upsert(new Block({id: c.header.hash, number: BigInt(c.header.height), timestamp: new Date(c.header.timestamp)}));
        for (let log of c.logs) {
            // decode and normalize the tx data GnosisSafe
            if(log.topics[0] === GnosisSafe.events.SignMsg.topic) {
                let {msgHash} = GnosisSafe.events.SignMsg.decode(log)
                let sig = new Sig({
                    id: log.id,
                    account: log.address,
                    msgHash: msgHash,
                    timestamp: new Date(c.header.timestamp),
                });
                ctx.log.info(`SignMsg: block: ${c.header.height}, ${sig.account}, ${sig.msgHash}, ${sig.timestamp}`);
                sigs.push(sig);
            }
            // decode and normalize the tx data SetDelegate
            if(log.topics[0] === DelegateRegistry.events.SetDelegate.topic) {
                let {id, delegator, space, delegate, timestamp} = extractData(DelegateRegistry.events.SetDelegate, log, c);
                ctx.log.info(`SetDelegate: block: ${c.header.height}, ${id}, ${delegator}, ${space}, ${delegate}, ${timestamp}`);
                delegationsSet.set(id, new Delegation({
                    id: id,
                    delegator: delegator,
                    space: space,
                    delegate: delegate,
                    timestamp: timestamp,
                }))
            }
            // decode and normalize the tx data ClearDelegate
            if(log.topics[0] === DelegateRegistry.events.ClearDelegate.topic) {
                let {id, delegator, space, delegate, timestamp} = extractData(DelegateRegistry.events.ClearDelegate, log, c);
                ctx.log.info(`ClearDelegate: block: ${c.header.height}, ${id}, ${delegator}, ${space}, ${delegate}, ${timestamp}`);
                let delegation = new Delegation({
                    id: id,
                    delegator: delegator,
                    space: space,
                    delegate: delegate,
                    timestamp: timestamp,
                })
                delegationsClear.push(delegation.id);
            }
        }
    }
    // apply vectorized transformations and aggregations
    const startBlock = ctx.blocks.at(0)?.header.height
    const endBlock = ctx.blocks.at(-1)?.header.height
    ctx.log.info(`Blocks:  ${startBlock} to ${endBlock}`)

    // upsert batches of entities with batch-optimized ctx.store.save
    await ctx.store.upsert(sigs);
    await ctx.store.upsert([...delegationsSet.values()]);
    await ctx.store.remove(Delegation, [...delegationsClear]);
});

function extractData(log: any, event: any, c: any): {
    id: string,
    delegator: string,
    space: string,
    delegate: string,
    timestamp: Date

} {
    let {delegator, id, delegate} = event.decode(log);
    let space = id
    let timestamp = new Date(c.header.timestamp);
    id = delegator.concat('-').concat(space).concat('-').concat(delegate).concat('').concat(c.header.timestamp.toString());
    return {id, delegator, space, delegate, timestamp};
}

