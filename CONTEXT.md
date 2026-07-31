# OpenOffice

A CLI that runs LLM agents equipped with tools to automate office document work.

## Language

**Agent**:
A named configuration bundle (description, allowed tools, model override) that becomes a live agent instance when a session starts.
_Avoid_: assistant, chatbot

**Model**:
A string naming an LLM. Resolution order: the agent's model, then the top-level default, then the provider's default.
_Avoid_: LLM

**Provider**:
An LLM service (openai, anthropic, ...) addressed by name in config, which holds its credentials.
_Avoid_: backend, service

**Session**:
One conversation: a live agent instance, its message history, and the active model. Identified by a runtime-generated sessionID.
_Avoid_: chat, conversation

**Tool**:
A callable unit exposed to the agent to perform an action.
_Avoid_: action, function, plugin

**Office**:
The capability to produce Office documents (.docx/.xlsx/.pptx) from templates via the officecli subprocess.
_Avoid_: documents

**Config**:
The project's typed configuration, loaded from layered sources (defaults, global, project) with environment overrides and env references.
_Avoid_: settings, options
