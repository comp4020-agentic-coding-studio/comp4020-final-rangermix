# Why best practices for coding agents keep expiring

Advice on coding agents keeps piling up: write a long `CLAUDE.md`, put key rules in capitals, split work across subagents. I argue that fixed rules are the wrong kind of advice. Whether a rule helps depends on the model and harness (the prompts, tools and checks around it) together, and both change every few months. The useful skill is re-testing and adjusting that setup. That skill depends on knowing software engineering as a whole system, which matters more as agents improve but is getting harder to learn.

First, results depend on the model and harness together. Zhang et al. (2026) ran three frontier models in three harnesses. The harness caused 7.8 times more variation in scores than the model did. In six of nine comparisons, switching harnesses flipped which of two models scored higher. The study is small, but even one added sentence can show the effect. A reminder to use Anthropic's advisor tool raised Haiku 4.5's pass rate by about seven points, made no measurable difference for Sonnet and slightly lowered it for Opus (Anthropic 2026a). So a rule only holds for one setup, and a model can only be judged inside a harness.

Second, as models improve, the best harness usually gets lighter. Rajasekaran (2026) writes that each part of a harness "encodes an assumption about what the model can't do on its own". He dropped context resets for Opus 4.5 and stopped splitting work into sprints for Opus 4.6. Cherny (2026) reports cutting over 80% of Claude Code's system prompt for Opus 5, and tells users to delete their `CLAUDE.md`, skills and hooks every six months. Gloaguen et al. (2026) found that LLM-written `AGENTS.md` files lowered task success and raised cost by over 20%, and developer-written ones barely helped. Agents followed the extra instructions even when they made the task harder. Anthropic's guide now says to soften shouted rules like "CRITICAL: You MUST use this tool", since newer models act on them too often (Anthropic 2026b). Long prompts also hurt, because models get less reliable as inputs grow (Hong et al. 2025). A fresh Claude Code install sends about 26,000 tokens before the first message, against about 2,400 for pi (COMP4020/8020 2026).

A lighter harness still needs the developer, whose job moves from listing steps to stating the goal and how to check it. With Claude Code's `/goal`, the developer writes a finish condition, and a separate model checks it after every turn (Anthropic 2026c). DeepSeek's new Creator Mode even lets the agent write plugins for its own harness (Dealroom 2026).

As a result, agent practices go out of date within months. Cognition's "Don't Build Multi-Agents" (Yan 2025) was revised by its own author ten months later (Yan 2026). Pi added MCP within a year of its author ruling it out (Zechner 2025; COMP4020/8020 2026). Much of the evidence for lighter harnesses comes from companies that want to show their newest model needs less help. It is safer to test changes on your own tasks, as Anthropic's guide itself recommends, than to adopt each new rule.

What lasts is the judgement to tell which parts of a harness still matter. Vercel's data agent improved after losing most of its tools, but only because its data layer was well documented (Qu 2025). Spotting that takes knowledge of the whole system, from its data to what "done" means. Böckeler (2026) calls a developer's experience a hidden harness that written rules only partly capture. Agents make this knowledge harder to build. In a short randomised trial, developers who learned a new library with AI help scored 50% on a later quiz. Those who coded by hand scored 67%, and the biggest gap was in debugging (Shen and Tamkin 2026). Storey (2026) calls a team's loss of shared understanding "cognitive debt". As Naur (1985) argued, the understanding behind a program lives in the people who built it.

The strongest objection is that harnesses do not fade as models improve. Zhang et al. (2026) argue that a better model does not take over the harness's job of recovering from errors and checking results. Both claims are true, for different parts of the harness. Parts that think for the model go out of date. Parts that check its work stay. Cherny says most of Claude Code's remaining code handles safety, permissions, static analysis and the interface. Rajasekaran kept his evaluator for tasks the model still could not do reliably alone.

Good practice is therefore a habit of re-testing. With each new model, remove the extra instructions, re-run past tasks (COMP4020/8020 2026), and add back only what the results justify. The habit is only as good as the engineer using it. That is why whole-system engineering knowledge keeps its value. The harder question for the field is how new engineers will learn it.

## References

Anthropic (2026a) *Advisor tool*. Claude Platform Docs. Available at: https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool (Accessed: 8 November 2026).

Anthropic (2026b) *Prompting best practices*. Claude Platform Docs. Available at: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices (Accessed: 8 November 2026).

Anthropic (2026c) *Keep Claude working toward a goal*. Claude Code Docs. Available at: https://code.claude.com/docs/en/goal (Accessed: 8 November 2026).

Böckeler, B. (2026) 'Harness engineering for coding agent users', *martinfowler.com*, 2 April. Available at: https://martinfowler.com/articles/harness-engineering.html

Cherny, B. (2026) 'Boris Cherny: Building Claude Code', interview with D. Hu, *Y Combinator Startup School*, 28 July. Transcript available at: https://podscripts.co/podcasts/y-combinator-startup-podcast/boris-cherny-building-claude-code

COMP4020/8020 (2026) *Week 10: Logs, harnesses and multi-user apps* [lecture slides]. Australian National University. Available at: https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/lectures/week-10/

Dealroom (2026) 'DeepSeek adds Creator Mode, lets users build agent plugins by chat', *Dealroom News*, 3 November. Available at: https://dealroom.co/news/169027-deepseek-adds-creator-mode-lets-users-build-agent-plugins-by-chat/

Gloaguen, T., Mündler, N., Müller, M., Raychev, V. and Vechev, M. (2026) 'Evaluating AGENTS.md: Are repository-level context files helpful for coding agents?', *arXiv*, 2602.11988. Available at: https://arxiv.org/abs/2602.11988

Hong, K., Troynikov, A. and Huber, J. (2025) *Context rot: How increasing input tokens impacts LLM performance*. Chroma Technical Report. Available at: https://research.trychroma.com/context-rot

Naur, P. (1985) 'Programming as theory building', *Microprocessing and Microprogramming*, 15(5), pp. 253–261.

Qu, A. (2025) 'We removed 80% of our agent's tools', *Vercel Blog*, 22 December. Available at: https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools

Rajasekaran, P. (2026) 'Harness design for long-running application development', *Anthropic Engineering*, 24 March. Available at: https://www.anthropic.com/research/harness-design-long-running-apps

Shen, J.H. and Tamkin, A. (2026) 'How AI assistance impacts the formation of coding skills', *Anthropic Research*, 29 January. Available at: https://www.anthropic.com/research/AI-assistance-coding-skills

Storey, M.-A. (2026) 'From technical debt to cognitive and intent debt: Rethinking software health in the age of AI', *arXiv*, 2603.22106. Available at: https://arxiv.org/abs/2603.22106

Yan, W. (2025) 'Don't build multi-agents', *Cognition Blog*, 12 June. Available at: https://cognition.ai/blog/dont-build-multi-agents

Yan, W. (2026) 'Multi-agents: What's actually working', *Cognition Blog*, 22 April. Available at: https://cognition.ai/blog/multi-agents-working

Zechner, M. (2025) 'What I learned building an opinionated and minimal coding agent', 30 November. Available at: https://mariozechner.at/posts/2025-11-30-pi-coding-agent/

Zhang, Y., Wang, J., Ge, Y., Xu, W., Hamm, J. and Reddy, C.K. (2026) 'Stop comparing LLM agents without disclosing the harness', *arXiv*, 2605.23950. Available at: https://arxiv.org/abs/2605.23950
