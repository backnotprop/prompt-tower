# prompt-tower

<img src="https://github.com/backnotprop/prompt-tower/blob/main/image.png?raw=true" alt="Prompt Tower" width="200"/>

A VS Code extension that helps you build prompts with lots of code blocks in them.

Install: https://marketplace.visualstudio.com/items?itemName=backnotprop.prompt-tower&ssr=false#overview

**0.1.9** Batch File Selection for Prompt Creation, idea by @arthurwolf:
![Demo](https://github.com/backnotprop/prompt-tower/blob/main/0.1.4.gif?raw=true)

## Features

Construct a prompt with multiple code blocks in it.

Commands:

- `Send File`: Send the current file to the prompt.
- `Send Selection`: Send the current selection to the prompt.
- `Send Function`: Send the current function to the prompt.
- `Send Class`: Send the current class to the prompt.
- `Send Class Method`: Send the current class method to the prompt.

Each code block is added to the tower and is wrapped in ` ``` ` ticks, with appropriate newlines. It's height indicates the block size (more code = taller block); until a certain threshold where too many blocks normalizes sizes. Blocks are movable, and its simple to add annotations (as new blocks) above or below each other.

See it in action:

![Demo](https://github.com/backnotprop/prompt-tower/blob/main/vscode.gif?raw=true)

After the prompt is built, it's ready to be sent to gpt:

![GPT](https://github.com/backnotprop/prompt-tower/blob/main/gpt.gif?raw=true)

## Release Notes

These are very early releases, please submit issues!

### 0.1.0

Initial release

### 0.1.9

- **New Feature: Batch File Selection for Prompt Creation**
  - Quickly select multiple files or folders with single clicks for prompt creation.
  - Simplify creating prompts by sending batches of files directly.
  - Use more context in your prompts easily with minimal clicks.
  - credit to [arthurwolf](https://github.com/arthurwolf) for the idea.

![Demo](https://github.com/backnotprop/prompt-tower/blob/main/0.1.4.gif?raw=true)
