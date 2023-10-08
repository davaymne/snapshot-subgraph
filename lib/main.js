"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_store_1 = require("@subsquid/typeorm-store");
const model_1 = require("./model");
const processor_1 = require("./processor");
const DelegateRegistry = __importStar(require("./abi/DelegateRegistry"));
const GnosisSafe = __importStar(require("./abi/GnosisSafe"));
const ProxyFactory100 = __importStar(require("./abi/GnosisSafeProxyFactory_v1.0.0"));
const ProxyFactory111 = __importStar(require("./abi/GnosisSafeProxyFactory_v1.1.1"));
const ProxyFactory130 = __importStar(require("./abi/GnosisSafeProxyFactory_v1.3.0"));
let factoryGnosis;
const PROXYFACTORY100 = '0x12302fE9c02ff50939BaAaaf415fc226C078613C'.toLowerCase();
const PROXYFACTORY111 = '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B'.toLowerCase();
const PROXYFACTORY130 = '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2'.toLowerCase();
const DELEGATEREGISTRY = '0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446'.toLowerCase();
processor_1.processor.run(new typeorm_store_1.TypeormDatabase({ supportHotBlocks: true }), async (ctx) => {
    const sigs = [];
    const delegationsSet = new Map();
    const delegationsClear = [];
    if (!factoryGnosis) {
        factoryGnosis = await ctx.store.findBy(model_1.Sig, {}).then((q) => new Set(q.map((i) => i.id)));
    }
    let gnosis = [];
    for (let c of ctx.blocks) {
        let delegateLog = false;
        for (let log of c.logs) {
            // decode and normalize the tx data GnosisSafe
            if ([PROXYFACTORY100, PROXYFACTORY111, PROXYFACTORY130].includes(log.address.toLowerCase())
                && [ProxyFactory100.events.ProxyCreation.topic, ProxyFactory111.events.ProxyCreation.topic, ProxyFactory130.events.ProxyCreation.topic].includes(log.topics[0])) {
                getGnosisID(ctx, log);
            }
            if (factoryGnosis.has(log.address.toLowerCase()) && log.topics[0] === GnosisSafe.events.SignMsg.topic) {
                sigs.push(getSig(ctx, log, c));
            }
            // decode and normalize the tx data SetDelegate
            if (log.topics[0] === DelegateRegistry.events.SetDelegate.topic) {
                if (log.address.toLowerCase() != DELEGATEREGISTRY) {
                    continue;
                }
                let { delegator, id, delegate } = DelegateRegistry.events.SetDelegate.decode(log);
                let space = id;
                id = delegator.concat('-').concat(space).concat('-').concat(delegate);
                ctx.log.info(`SetDelegate: block: ${c.header.height}, id: ${id}, delegator: ${delegator}, space: ${space}, delegate: ${delegate}`);
                delegationsSet.set(id, new model_1.Delegation({
                    id: id,
                    delegator: delegator,
                    space: space,
                    delegate: delegate,
                    timestamp: new Date(c.header.timestamp),
                }));
                delegateLog = true;
            }
            // decode and normalize the tx data ClearDelegate
            if (log.topics[0] === DelegateRegistry.events.ClearDelegate.topic) {
                if (log.address.toLowerCase() != DELEGATEREGISTRY) {
                    continue;
                }
                let { delegator, id, delegate } = DelegateRegistry.events.ClearDelegate.decode(log);
                let space = id;
                id = delegator.concat('-').concat(space).concat('-').concat(delegate);
                if (delegationsSet.has(id)) {
                    ctx.log.info(`ClearDelegate: removing Delegation from runtime Set: block: ${c.header.height}, id: ${id}, delegator: ${delegator}, space: ${space}, delegate: ${delegate}`);
                    delegationsSet.delete(id);
                }
                else {
                    ctx.log.info(`ClearDelegate: block: ${c.header.height}, id: ${id}, delegator: ${delegator}, space: ${space}, delegate: ${delegate}`);
                    delegationsClear.push(id);
                }
                delegateLog = true;
            }
        }
        if (delegateLog === true) {
            await ctx.store.upsert(new model_1.Block({ id: c.header.hash, number: BigInt(c.header.height), timestamp: new Date(c.header.timestamp) }));
        }
    }
    // apply vectorized transformations and aggregations
    const startBlock = ctx.blocks.at(0)?.header.height;
    const endBlock = ctx.blocks.at(-1)?.header.height;
    ctx.log.info(`Blocks:  ${startBlock} to ${endBlock}`);
    // upsert batches of entities with batch-optimized ctx.store.save
    await ctx.store.upsert(sigs);
    if (delegationsClear.length != 0) {
        await ctx.store.remove(model_1.Delegation, [...delegationsClear]);
    }
    await ctx.store.upsert([...delegationsSet.values()]);
});
function getSig(ctx, log, c) {
    let { msgHash } = GnosisSafe.events.SignMsg.decode(log);
    let sig = new model_1.Sig({
        id: log.transaction?.hash.toString().concat('-').concat(log.id),
        account: log.address,
        msgHash: msgHash,
        timestamp: new Date(c.header.timestamp),
    });
    ctx.log.info(`SignMsg: block: ${c.header.height}, id: ${sig.id}, account: ${sig.account}, msgHash: ${sig.msgHash}, timestamp: ${sig.timestamp}`);
    return sig;
}
function getGnosisID(ctx, log) {
    let proxy = '';
    if (log.address.toLowerCase() === PROXYFACTORY100) {
        proxy = ProxyFactory100.events.ProxyCreation.decode(log).proxy;
    }
    if (log.address.toLowerCase() === PROXYFACTORY111) {
        proxy = ProxyFactory111.events.ProxyCreation.decode(log).proxy;
    }
    if (log.address.toLowerCase() === PROXYFACTORY130) {
        let event = ProxyFactory130.events.ProxyCreation.decode(log);
        proxy = event.proxy;
    }
    factoryGnosis.add(proxy.toLowerCase());
    //ctx.log.info(`Add Gnosis ID: block: ${log.block.height}, proxy: ${proxy.toLowerCase()}`)
    return proxy;
}
//# sourceMappingURL=main.js.map