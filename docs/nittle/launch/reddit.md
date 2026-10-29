# Reddit drafts

Drafts for Cody. Nothing here has been posted.

Before each one, read the sub's sidebar rules that day. Most allow a project post if you say you made it, answer comments, and don't post the same thing in five subs in one day. One sub per day, in the order below. Reply to everything in the first two hours, that's when a post lives or dies.

Attach the walkthrough GIF (docs/screenshots/walkthrough.gif) or a still where the sub allows images. Video posts on Reddit autoplay muted, so the GIF works better than a link.

## 1. r/ClaudeAI

Flair: "Built with Claude" if it's offered (the sub requires it for project posts). Say what Claude did and didn't do if their rule asks for it.

Title: I made a diff viewer where you click a line to comment, and Claude Code gets the comments back over MCP

Body:

I got tired of typing "second file, around the retry loop, you swallow the error" into Claude Code and having it fix the wrong loop. So I built a diff viewer where I click the line instead.

It's called nittle. Free, MIT, runs locally.

    curl -fsSL https://nittle.dev/install | sh
    nittle setup

`nittle setup` finds Claude Code, shows you what it's going to run, asks, then installs the plugin. Start a new session and say "review my changes with nittle". Your browser opens on the diff and Claude waits.

You leave comments on lines, ranges or whole files and hit Return Feedback. Claude reads them with the exact file, line and surrounding code, makes the changes, replies in each thread and marks them addressed. Then it asks for another round. You look at what it changed, approve, or send more.

Some other stuff in there: vim-ish keys (j/k, c to comment, gd for go-to-definition), a scorecard that flags removed public API and missing tests before you start reading, and suggested changes Claude can apply directly.

Docs: https://nittle.dev/guides/agent-feedback/
Repo: https://github.com/codywilliamson/nittle

How do you review what Claude writes right now? Terminal git diff, a PR, just trust it?

## 2. r/ChatGPTCoding

Title: Made a local tool for reviewing any coding agent's diff line by line (works with Codex, Cursor, Gemini CLI, or just copy-paste)

Body:

Disclosure: I made this.

Whatever agent you use, the review step is the same mess. It says it's done, you open a diff, and you type feedback back in prose. Line references get fuzzy and half the comments get lost.

nittle is a diff viewer for that step. Run it in a repo, the diff opens in your browser, you comment on lines, and it turns the comments into a prompt with the file, line and code around each one.

    nittle            # working tree vs HEAD
    nittle main       # this branch vs main
    nittle --wait     # blocks until you return feedback, prints the prompt on stdout

If your agent does MCP, it can run the whole loop itself: start a review, read your comments, reply, mark them addressed, ask for another pass. `nittle setup` wires up Codex, Cursor, Gemini CLI, VS Code, Windsurf, OpenCode, Zed and Copilot CLI, and shows you every file it'll touch first. `nittle setup --remove` undoes it.

No account, nothing hosted. Single binary for Mac, Linux and Windows.

https://nittle.dev

Rough edges: no GitHub PR mode yet, images just say "binary file", and go-to-definition needs you to install the language server.

Which agent are you using, and do you actually read the diff before accepting?

## 3. r/cursor

Title: Line-by-line review for Cursor's agent diffs, comments go back over MCP

Body:

Disclosure: I built this. It's free and open source.

Cursor's diff view is fine for accepting hunks, but I wanted to leave real review comments, the "this swallows the error, and this name is wrong" kind, and have the agent work through them.

nittle opens the working tree diff in a browser tab. You comment on lines or ranges, then hit Return Feedback. With the MCP server set up (`nittle setup --agents cursor`), Cursor's agent can read the comments, reply to each one, mark them addressed and ask for another look.

    curl -fsSL https://nittle.dev/install | sh
    nittle setup --agents cursor

Setup guide: https://nittle.dev/guides/agent-feedback/

Curious whether people here review in Cursor itself or somewhere else.

## 4. r/dotnet (or r/csharp, not both)

Lead with the C# angle. This crowd is skeptical of AI posts, so make it about review, not about agents.

Title: I built a local diff reviewer with C# first-class: go-to-definition in the diff, and review flags for async void, .Result, EF migrations and NuGet bumps

Body:

Disclosure: my project, MIT licensed.

nittle is a git diff viewer that runs in your browser from the command line. I built it to review code coding agents write, but it works for any diff.

The C# parts:

- Go-to-definition, references and hover right in the diff, using a C# language server you have installed (`nittle lsp` shows what it found).
- A scorecard before you read: flags `async void`, blocking waits (`.Result`, `.Wait()`, `GetAwaiter().GetResult()`), `#pragma warning disable`, skipped tests, `null!`, and changes to Program.cs, appsettings, .csproj, Directory.Build.props, web.config and EF migrations.
- It reads PackageReference, central package versions and TargetFramework changes, so a NuGet bump shows up as its own flag.
- Test projects are matched to what they test, so "changed code with no test change" means something.

No model in any of that, it's all fixed rules.

    nittle main     # review this branch against main

Windows install: `pwsh -c "irm https://nittle.dev/install.ps1 | iex"` (PowerShell 7).

https://nittle.dev/guides/review-scorecard/

What would you want flagged that isn't there?

## 5. r/SideProject

Title: nittle: I spent the last few months building a diff reviewer for coding agents, launched today

Body:

Short version: a local git diff viewer where you comment on lines and the comments go back to your coding agent, which fixes things, replies and asks for another round.

It started as "loupe" in June, became "diffle", then turned out someone else had diffle first, so now it's nittle. Single binary, MIT, works with nine agents or with copy-paste.

https://nittle.dev

Happy to talk about how it's built: Bun backend, Svelte 5 UI, and the demo videos are recorded by Playwright driving the real app and composited with Remotion.

## Skip

- r/programming: bans "I made this" posts.
- r/webdev, r/javascript: Showoff Saturday only, and it's off-topic there anyway.
