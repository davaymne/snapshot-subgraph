import {TypeormDatabase} from '@subsquid/typeorm-store'
import {Delegation} from './model'
import {processor} from './processor'
import * as DelegateRegistry from "./abi/DelegateRegistry";

processor.run(new TypeormDatabase({supportHotBlocks: true}), async (ctx) => {
    const delegations: Delegation[] = []
    for (let c of ctx.blocks) {
        for (let log of c.logs) {
            // decode and normalize the tx data
            if(log.topics[0] === DelegateRegistry.events.SetDelegate.topic) {
                let {delegator, id, delegate} = DelegateRegistry.events.SetDelegate.decode(log)
                let delegation = new Delegation({
                    id: id.toString(),
                    delegator: delegator,
                    space: id,
                    delegate: delegate,
                    timestamp: 


                });
            }
        }
    }
    // apply vectorized transformations and aggregations
    const burned = burns.reduce((acc, b) => acc + b.value, 0n) / 1_000_000_000n
    const startBlock = ctx.blocks.at(0)?.header.height
    const endBlock = ctx.blocks.at(-1)?.header.height
    ctx.log.info(`Burned ${burned} Gwei from ${startBlock} to ${endBlock}`)

    // upsert batches of entities with batch-optimized ctx.store.save
    await ctx.store.upsert(burns)
})
