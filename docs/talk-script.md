# Talk Script: Mod Development for EVE Frontier

## 1. Opening — 45 seconds

Good afternoon everyone, and thank you for joining.

Today I want to talk about **mod development for EVE Frontier**, but I want to frame it through a newer builder behavior: **AI vibe coding**.

By vibe coding, I do not mean blindly accepting whatever an agent writes. I mean using an AI agent as a practical development companion: it reads the repository, follows the documented workflow, runs the setup commands, checks the environment, and helps the builder keep momentum while the builder stays responsible for the direction and the final result.

The key idea I want to share is this:

**EVE Frontier is not just a game where builders create content. It is a programmable world where builders can create systems, and AI agents can now help builders reach that system-building loop much faster.**

That difference is important.

A piece of content may be static. But a system has logic. It has rules. It has permissions. It reacts to players. It connects to interfaces. And eventually, it can become part of how the world behaves.

The hard part for many builders is not imagination. The hard part is getting through the stack: Sui, Move, localnet, Smart Assemblies, APIs, wallets, and frontend integration.

This is where AI vibe coding changes the feel of development. It shortens the distance between an idea and a working prototype.

To make this possible, Frontier still needs the right technical foundation. That is why Sui is such an important part of the architecture.

---

## 2. Why Sui Works for Frontier — 2.5 minutes

So first, why does Sui work well for Frontier?

The first reason is that **Sui is built around objects, not just accounts**.

This is a very natural fit for a game world.

In Frontier, many things can be understood as objects: items, smart assemblies, ownership records, machines, permissions, and world state. When the blockchain itself is object-centric, it becomes easier to map game concepts into on-chain systems.

This also gives us a clear ownership model. Builders and players can reason about who owns what, who can modify what, and how different parts of the world interact.

So instead of forcing a game world into a purely account-based model, Sui provides a model that fits the structure of the world much better.

The second reason is **parallel execution**.

In a high-activity world, many players may interact with many different objects at the same time. If every action had to wait in one global queue, the world would quickly hit bottlenecks.

Sui allows independent objects to be updated in parallel. That means many interactions can happen at the same time, as long as they touch different pieces of state.

For Frontier, this matters a lot. A world with many players, many items, many assemblies, and many builder-created systems needs to scale naturally.

The third reason is the **Move language**.

Move gives builders a safer and more expressive way to write smart contract logic. It has strong type safety and a clear ownership and permission model.

For Frontier, this is especially important because builders are not only writing financial logic. They are writing **world logic**.

They may create trading machines, automated factories, access-controlled gates, or other programmable infrastructure. These systems need rules, conditions, permissions, and state transitions.

Move helps express those rules in a safer and more structured way.

Another important point is cost. Frontier needs frequent interactions. Players may update state, move items, or interact with smart assemblies many times. Low and predictable transaction costs make this kind of interaction practical.

And finally, Sui also helps with onboarding. Features such as zkLogin can make the Web2 to Web3 transition smoother, helping users access wallet-based functionality with less friction.

So overall, Sui provides a strong foundation for Frontier: objects, parallel execution, Move, predictable fees, and infrastructure for builder-created systems.

---

## 3. Builder Stack Overview — 45 seconds

Now let’s move from the foundation to the builder stack.

For mod development, builders need several kinds of access.

They need **write access** to change the world.
They need **read access** to understand the world.
They need **player-facing tools** so users can interact with their systems.
And they need **world data** to build useful interfaces and workflows.

In Frontier, these pieces come together through several tools:

Move contracts, Smart Assemblies, GraphQL, gRPC, custom dApps, the World API, and sandbox access to Utopia.

Together, these form the Frontier modding and tooling stack.

---

## 4. Move Contracts and Smart Assemblies — 1.5 minutes

Let’s start with write access.

Move contracts define custom logic. They allow builders to write rules that run on-chain.

But logic alone is not enough. That logic needs to connect to the game world.

This is where **Smart Assemblies** become important.

Smart Assemblies are one of the core extension points in Frontier. They allow custom rules and actions to become part of world interaction.

This is where builders move from static objects to programmable systems.

For example, imagine a smart gate. A builder can define who is allowed to use it, under what conditions it opens, what state changes after it is used, and how it interacts with other systems.

Or imagine an automated factory. A builder can define input requirements, processing rules, permissions, and output behavior.

In both cases, the builder is not just creating a UI or an external tool. The builder is defining how part of the world behaves.

That is why write access is so important.

**Write access is not just about sending transactions. It is about changing the rules of interaction inside the world.**

For mod development, this is the most powerful idea: builders can create logic that becomes part of Frontier itself.

---

## 5. Read Access: GraphQL and gRPC — 1 minute

But write access is only one side of the story.

Builders also need to read and observe the world.

This is where **GraphQL and gRPC** are important.

When builders create a system, they need to understand the current state of objects, events, ownership, assemblies, and other system information.

This read access enables many different kinds of tools.

It enables frontends that show live system state.
It enables dashboards for monitoring activity.
It enables automation that reacts to events.
It enables analytics that help builders understand how players use their systems.

Without query access, builders may be able to deploy logic, but it would be difficult to make that logic usable.

So I like to summarize it this way:

**If write access changes the world, query access makes the world observable.**

And observability is what turns raw logic into something builders and players can actually use.

---

## 6. World API — 45 seconds

In addition to on-chain state, builders also need access to game-world data.

That is the role of the **World API**.

The World API provides reference and world-level information, such as item types, names, icons, universe data, constellations, solar systems, and other game information.

This is especially useful when building interfaces and helper tools.

For example, if a dApp needs to display item names and icons, it should not hard-code everything manually. If a tool needs to show solar system or constellation information, it needs world data.

So we can think of it this way:

**GraphQL and gRPC expose on-chain state. The World API exposes the game-world layer around it.**

Together, these APIs give builders the context they need to build useful tools.

---

## 7. Builder Scaffold and AI Vibe Coding — 1.5 minutes

Now let’s talk about how builders actually get started.

This is where **builder-scaffold** comes in.

Builder-scaffold is the starting point for builder onboarding. It provides a structured repository for building against Frontier.

It includes starter code, scripts, examples, and integration patterns.

This matters because setup friction is one of the biggest barriers for builders. If it takes too long to install tools, understand the environment, find examples, and connect everything together, many people never reach the creative part.

Builder-scaffold helps reduce that friction, and AI agents make that reduction even stronger.

Here is a concrete example from my own experience.

About a year ago, when I used an agent for Sui development, I still had to guide it very carefully. A common pattern was: tell the agent to go read the Sui documentation, ask it to learn the current commands, then ask it to try the setup. Even then, it could still make mistakes. It might use an outdated command, misunderstand the localnet flow, or produce a step that looked reasonable but failed in practice.

Today, the experience feels different.

With a repo like builder-scaffold, I can ask an agent to follow the documented workflow and bring up a localnet, or prepare the testnet-oriented path. In my experience, it can usually do that smoothly in a few minutes. It understands the role of Docker, the Sui CLI, Node.js scripts, Move packages, and verification commands well enough to stay inside the project workflow.

That changes the builder experience.

Builder-scaffold is not just a sample repository. It becomes a workflow that an AI agent can execute with the builder.

The goal is to help builders move quickly from:

“I have an idea”

to:

“I have a working prototype.”

And AI vibe coding makes that path feel much shorter.

---

## 8. Tutorial Part 1: Agent-Assisted Localnet Setup — 1 minute

The first tutorial step is **localnet setup**.

This is where builders get a local development environment running.

The core tools include Docker, Sui CLI, and Node.js.

Traditionally, this is the kind of step where people lose time. They read docs, switch between terminal commands, hit a version mismatch, restart a service, and then try to remember what the next step was supposed to be.

With AI vibe coding, the workflow becomes more conversational.

You can ask the agent:

“Follow the builder-scaffold docs and start the local Sui development environment. Verify that localnet is running, then tell me the next command to build, publish, or test a Move package.”

That is a very different starting point.

The goal here is simple: build and publish a minimal contract locally.

Localnet is the right starting point because it supports fast iteration. Builders can test ideas, make mistakes, reset, and try again without depending on a live environment.

But now the setup step can become less of a wall and more of a guided path.

At this stage, the goal is not depth. The goal is readiness.

Once the local environment works, builders are ready to move into real world logic.

---

## 9. Tutorial Part 2: Creating a Smart Contract — 1 minute

The second tutorial step is **creating a smart contract**.

In the scaffold, one example is `move-contracts/smart_gate_extension`.

This is where builders move from setup into authorship.

They start writing custom Move logic. They define rules, conditions, permissions, and state transitions.

This is the first point where the builder is not only using tools, but creating behavior.

For example, with a smart gate extension, the builder can define who can interact with a gate, when it can be used, and what happens after the interaction.

This is an important step because it shows what Frontier mod development really means.

It is not only about building something outside the game. It is about creating logic that can become part of the world.

---

## 10. Tutorial Part 3: Connecting a Live dApp — 1 minute

The third tutorial step is **connecting a live dApp**.

A smart contract defines the rules, but players need a way to interact with those rules.

That means builders need a frontend. They need state queries. They need wallet or vault integration. And they need a usable interaction flow.

This part introduces a frontend app built around tools such as EVE Vault, the React SDK or EFrontierKit, and state queries.

The goal is not just to display data.

The goal is to create a real interaction loop.

A player should be able to open an interface, see the current world state, perform an action, and then see the result reflected back in the system.

This is the point where builder logic becomes player-facing and operational.

A system becomes usable when logic is connected to interface.

---

## 11. From Tutorial to AI-Assisted Builder Workflow — 1 minute

So when we look at the three tutorial parts together, they are not isolated exercises.

They form a complete builder path.

First, set up the environment.
Second, define custom world logic.
Third, connect that logic to a usable interface.

This is the real purpose of builder-scaffold.

It gives builders a repeatable workflow for going from setup, to logic, to interaction.

AI agents are becoming useful because they can follow that repeatable workflow. They can read the repo, run the documented commands, inspect errors, check the next step, and keep the builder moving.

The builder still decides what to build.

The agent helps reduce the mechanical friction around how to build it.

And that repeatability matters.

The easier it is for builders to follow this path, the more experiments we will see. The more experiments we see, the more examples the community can learn from. And the more examples the community shares, the faster the ecosystem grows.

---

## 12. Closing — 45 seconds

To close, I want to return to the main idea.

EVE Frontier mod development is about building programmable systems inside a persistent world.

Sui provides the technical foundation: objects, parallel execution, Move, predictable fees, and strong infrastructure.

Frontier provides the builder stack: Move contracts, Smart Assemblies, GraphQL, gRPC, custom dApps, the World API, and sandbox access.

Builder-scaffold provides the practical workflow: localnet setup, smart contract development, and live dApp integration.

And AI vibe coding helps builders move through that workflow faster.

So for anyone who wants to build, the path is simple:

Join the Discord.
Read the docs.
Clone the scaffold.
Ask an agent to help you bring up the environment.
Start experimenting.

Build something small first. Then connect it to the world. Then make it usable for players.

The important thing is to keep the creative loop short.

Because the future of Frontier will not only be built by the core team.

It will also be shaped by builders who create new systems, new tools, and new possibilities inside the world, with AI agents helping them get from idea to prototype faster than before.

Thank you, and happy hacking.
