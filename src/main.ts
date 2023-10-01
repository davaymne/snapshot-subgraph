import {TypeormDatabase} from '@subsquid/typeorm-store'
import {Delegation, Block, Sig} from './model'
import {processor} from './processor'
import * as DelegateRegistry from "./abi/DelegateRegistry";
import * as GnosisSafe from "./abi/GnosisSafe";

processor.run(new TypeormDatabase({supportHotBlocks: true}), async (ctx) => {
    for (let c of ctx.blocks) {
        const sigs: Sig[] = []
        await ctx.store.upsert(new Block({id: c.header.hash, number: BigInt(c.header.height), timestamp: new Date(c.header.timestamp)}));
        for (let log of c.logs) {
            const delegations: Delegation[] = []
            // decode and normalize the tx data
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
            if(log.topics[0] === DelegateRegistry.events.SetDelegate.topic) {
                let {delegator, id, delegate} = DelegateRegistry.events.SetDelegate.decode(log)
                let delegation = new Delegation({
                    id: delegator.concat('-').concat(id).concat('-').concat(delegate),
                    delegator: delegator,
                    space: id,
                    delegate: delegate,
                    timestamp: new Date(c.header.timestamp),
                });
                ctx.log.info(`SetDelegate: block: ${c.header.height}, ${delegation.id}, ${delegation.delegator}, ${delegation.space}, ${delegation.delegate}, ${delegation.timestamp}`);
                delegations.push(delegation);
                await ctx.store.upsert(delegations);
            }
            if(log.topics[0] === DelegateRegistry.events.ClearDelegate.topic) {
                let {delegator, id, delegate} = DelegateRegistry.events.ClearDelegate.decode(log)
                let delegation = new Delegation({
                    id: delegator.concat('-').concat(id).concat('-').concat(delegate),
                    delegator: delegator,
                    space: id,
                    delegate: delegate,
                    timestamp: new Date(c.header.timestamp),
                });
                ctx.log.info(`ClearDelegate: block: ${c.header.height}, ${delegation.id}, ${delegation.delegator}, ${delegation.space}, ${delegation.delegate}, ${delegation.timestamp}`);
                delegations.push(delegation);
                await ctx.store.remove(Delegation, [delegation.id]);
            }
        }
    }
    // apply vectorized transformations and aggregations
    const startBlock = ctx.blocks.at(0)?.header.height
    const endBlock = ctx.blocks.at(-1)?.header.height
    ctx.log.info(`Delegations  ${startBlock} to ${endBlock}`)

    // upsert batches of entities with batch-optimized ctx.store.save
    await ctx.store.upsert(sigs);
})
