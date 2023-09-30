import {TypeormDatabase} from '@subsquid/typeorm-store'
import {Delegation} from './model'
import {processor} from './processor'
import * as DelegateRegistry from "./abi/DelegateRegistry";

processor.run(new TypeormDatabase({supportHotBlocks: true}), async (ctx) => {
    for (let c of ctx.blocks) {
        for (let log of c.logs) {
            const delegations: Delegation[] = []
            // decode and normalize the tx data
            if(log.topics[0] === DelegateRegistry.events.SetDelegate.topic) {
                let {delegator, id, delegate} = DelegateRegistry.events.SetDelegate.decode(log)
                let delegation = new Delegation({
                    id: delegator.concat('-').concat(id).concat('-').concat(delegate),
                    delegator: delegator,
                    space: id,
                    delegate: delegate,
                    timestamp: c.header.timestamp,
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
                    timestamp: c.header.timestamp,
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
    // await ctx.store.upsert(delegations);
})
