# Snapshot Subgraph

This is a starter **Snapshot Subgraph** ported from The Graph [Snapshot Subgraph](https://thegraph.com/hosted-service/subgraph/snapshot-labs/snapshot). 
See [Squid SDK docs](https://docs.subsquid.io/) for a complete reference.

## Quickstart and run locally

```bash
# 0. Install @subsquid/cli a.k.a. the sqd command globally
npm i -g @subsquid/cli

# 1. Install dependencies
npm ci

# 2. Clone current repository
git clone https://github.com/davaymne/snapshot-subgraph

# 3. Build project
sqd build

# 4. Start a Postgres database container and detach
sqd up

# 5. Build and start the processor
sqd process

# 6. The command above will block the terminal
#    being busy with fetching the chain data, 
#    transforming and storing it in the target database.
#
#    To start the graphql server open the separate terminal
#    and run
sqd serve
```
>> NOTE: A GraphiQL playground will be available at [localhost:4350/graphql](http://localhost:4350/graphql).

## Query Examples:

### Squid Query
```
query MyQuery {
  delegations (limit:2){
    delegate
    delegator
    id
    space
    timestamp
  }
}
```
Output:
<img width="1453" alt="Screenshot 2023-10-01 at 04 14 37" src="https://github.com/davaymne/snapshot-subgraph/assets/29555611/de14f9a5-6a92-4f06-9b0d-c7c649de26a5">



### The Graph Query
```
{
  delegations(first: 2) {
    id
    delegator
    space
    delegate
    timestamp
  }
}
```
Output:
<img width="1391" alt="Screenshot 2023-10-01 at 04 08 45" src="https://github.com/davaymne/snapshot-subgraph/assets/29555611/6fb73827-718a-494d-b4fb-ad807508e88d">



