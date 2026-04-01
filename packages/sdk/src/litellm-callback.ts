/**
 * LiteLLM Callback Handler for InferLane
 *
 * This file provides a Python callback class as a string template.
 * Partners copy this into their LiteLLM setup:
 *
 *   litellm.success_callback = ["inferlane"]
 *
 * Or manually:
 *   from inferlane_callback import InferLaneCallback
 *   litellm.callbacks = [InferLaneCallback()]
 *
 * The actual Python code is exported as a string constant for easy
 * inclusion in documentation or auto-generation.
 */

/**
 * Python callback code for LiteLLM integration.
 * Partners save this as `inferlane_callback.py` alongside their LiteLLM config.
 *
 * Required env var: INFERLANE_API_KEY=ilp_...
 * Optional env var: INFERLANE_BASE_URL (defaults to https://inferlane.ai)
 */
export const LITELLM_CALLBACK_PYTHON = `
"""
InferLane callback for LiteLLM — batches and sends usage data.

Setup:
  pip install requests
  export INFERLANE_API_KEY=ilp_your_partner_key

  # In your LiteLLM config:
  import litellm
  from inferlane_callback import InferLaneCallback
  litellm.callbacks = [InferLaneCallback()]
"""

import os
import json
import threading
import time
from datetime import datetime, timezone
from typing import Any, Optional

try:
    import requests
except ImportError:
    raise ImportError("requests is required: pip install requests")

try:
    from litellm.integrations.custom_logger import CustomLogger
except ImportError:
    # Fallback for older LiteLLM versions
    class CustomLogger:
        def log_success_event(self, kwargs, response_obj, start_time, end_time): pass
        def log_failure_event(self, kwargs, response_obj, start_time, end_time): pass


class InferLaneCallback(CustomLogger):
    """
    Batches LLM usage records and sends them to InferLane every 10 seconds
    or when the batch reaches 100 records.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        batch_size: int = 100,
        flush_interval: float = 10.0,
    ):
        self.api_key = api_key or os.environ.get("INFERLANE_API_KEY", "")
        if not self.api_key:
            raise ValueError(
                "INFERLANE_API_KEY env var or api_key param is required"
            )

        self.base_url = (
            base_url
            or os.environ.get("INFERLANE_BASE_URL", "https://inferlane.ai")
        ).rstrip("/")

        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self._buffer: list[dict] = []
        self._lock = threading.Lock()
        self._start_flush_timer()

    def _start_flush_timer(self):
        self._timer = threading.Timer(self.flush_interval, self._timed_flush)
        self._timer.daemon = True
        self._timer.start()

    def _timed_flush(self):
        self.flush()
        self._start_flush_timer()

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        try:
            model = kwargs.get("model", "unknown")
            litellm_params = kwargs.get("litellm_params", {})
            custom_llm_provider = litellm_params.get("custom_llm_provider", "")

            # Extract provider from model string or litellm params
            provider = self._resolve_provider(model, custom_llm_provider)

            usage = getattr(response_obj, "usage", None)
            if not usage:
                return

            input_tokens = getattr(usage, "prompt_tokens", 0) or 0
            output_tokens = getattr(usage, "completion_tokens", 0) or 0

            latency_ms = 0
            if start_time and end_time:
                latency_ms = int((end_time - start_time).total_seconds() * 1000)

            # User ref from metadata if available
            metadata = kwargs.get("metadata", {}) or {}
            user_ref = metadata.get("inferlane_user", metadata.get("user", ""))

            record = {
                "userRef": str(user_ref),
                "provider": provider,
                "model": model.split("/")[-1],  # strip provider prefix
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "latencyMs": latency_ms,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            with self._lock:
                self._buffer.append(record)
                if len(self._buffer) >= self.batch_size:
                    self._do_flush()

        except Exception as e:
            print(f"[InferLane] Error in callback: {e}")

    def log_failure_event(self, kwargs, response_obj, start_time, end_time):
        # Don't track failed requests
        pass

    def flush(self):
        with self._lock:
            self._do_flush()

    def _do_flush(self):
        if not self._buffer:
            return

        records = self._buffer[:]
        self._buffer.clear()

        try:
            resp = requests.post(
                f"{self.base_url}/api/integrations/ingest",
                json={"records": records},
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=15,
            )
            if resp.status_code != 200:
                print(f"[InferLane] Ingest failed ({resp.status_code}): {resp.text[:200]}")
        except Exception as e:
            print(f"[InferLane] Flush error: {e}")

    @staticmethod
    def _resolve_provider(model: str, custom_provider: str) -> str:
        if custom_provider:
            return custom_provider.upper()

        provider_prefixes = {
            "gpt-": "OPENAI", "o1": "OPENAI", "o3": "OPENAI",
            "claude-": "ANTHROPIC",
            "gemini": "GOOGLE",
            "command": "COHERE",
            "mistral": "MISTRAL", "mixtral": "MISTRAL",
            "llama": "TOGETHER",
            "grok": "XAI",
            "sonar": "PERPLEXITY",
            "deepseek": "DEEPSEEK",
        }

        model_lower = model.lower().split("/")[-1]
        for prefix, provider in provider_prefixes.items():
            if model_lower.startswith(prefix):
                return provider

        # Check for provider/ prefix in model string
        if "/" in model:
            return model.split("/")[0].upper()

        return "UNKNOWN"
`.trim();

/**
 * README content for partners setting up the LiteLLM callback.
 */
export const LITELLM_SETUP_GUIDE = `
# InferLane + LiteLLM Integration

## Quick Setup

1. Install: \`pip install requests\`
2. Save \`inferlane_callback.py\` to your project
3. Set env var: \`export INFERLANE_API_KEY=ilp_your_partner_key\`
4. Add to your LiteLLM config:

\`\`\`python
from inferlane_callback import InferLaneCallback
import litellm

litellm.callbacks = [InferLaneCallback()]
\`\`\`

## User Attribution

Pass a InferLane user ID or email in metadata:

\`\`\`python
response = litellm.completion(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
    metadata={"inferlane_user": "user@example.com"}
)
\`\`\`

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| INFERLANE_API_KEY | (required) | Partner callback key |
| INFERLANE_BASE_URL | https://inferlane.ai | API base URL |

## Batch Behavior

Records are buffered and flushed every 10 seconds or when 100 records
accumulate, whichever comes first. This minimizes HTTP overhead.
`.trim();
