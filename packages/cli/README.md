# @inferlane/cli

Command-line interface for InferLane. Manage providers, check costs, and dispatch prompts from your terminal.

## Install

```bash
npm install -g @inferlane/cli
```

## Commands

```bash
# Initialize configuration
inferlane init

# Check session cost
inferlane status

# Pick optimal model
inferlane pick-model --task code_generation --priority cheapest

# Dispatch a prompt
inferlane dispatch "Explain quantum computing" --routing auto

# View savings
inferlane savings --period 30d

# List connected providers
inferlane providers

# Check provider health
inferlane health
```

## Configuration

Config stored at `~/.inferlane/config.json`. Set your API key:

```bash
inferlane init
```

## License

Apache-2.0
