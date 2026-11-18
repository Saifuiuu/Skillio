"""Health check script for configured LLM provider chain.

Run with: python -m scripts.llm_check
"""

from __future__ import annotations

import sys
import time

import httpx

from app.core.config import settings
from app.services.llm.base import LLMOutputError, LLMUnavailableError
from app.services.llm.ollama import OllamaClient


def check_ollama() -> bool:
    base_url = settings.OLLAMA_BASE_URL.rstrip("/")
    model = settings.OLLAMA_MODEL
    print(f"--> Checking Ollama at {base_url} (model: {model})...")

    # 1. Reachability & tags
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(f"{base_url}/api/tags")
    except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
        print(f"[FAIL] Ollama is unreachable at {base_url}: {exc}")
        print("       Hint: Ensure Ollama is installed and running (`ollama serve`).")
        return False
    except Exception as exc:  # noqa: BLE001
        print(f"[FAIL] Unexpected error reaching Ollama: {exc}")
        return False

    if resp.is_error:
        print(f"[FAIL] Ollama returned HTTP {resp.status_code}: {resp.text[:200]}")
        return False

    try:
        tags_data = resp.json()
        models = [m.get("name", "") for m in tags_data.get("models", [])]
    except Exception:  # noqa: BLE001
        models = []

    model_present = any(
        m == model or m.startswith(f"{model}:") or model.startswith(f"{m}:")
        for m in models
    )
    if not model_present:
        print(f"[WARN] Model '{model}' not found in installed Ollama models.")
        if models:
            print(f"       Installed models: {', '.join(models)}")
        print(f"       Hint: Run `ollama pull {model}` to download it.")

    # 2. Test generation
    client = OllamaClient(
        base_url=base_url,
        model=model,
        timeout_seconds=min(30.0, float(settings.LLM_TIMEOUT_SECONDS)),
    )
    schema = {
        "type": "object",
        "properties": {"status": {"type": "string"}},
        "required": ["status"],
    }

    start = time.perf_counter()
    try:
        output = client.generate_json(
            system="You are a healthcheck responder.",
            prompt="Respond with JSON containing status 'ok'.",
            schema=schema,
        )
        duration = time.perf_counter() - start
        print(f"[OK]   Ollama ({model}) reachable and responsive.")
        print(f"       Response time: {duration:.2f}s")
        print(f"       Output: {output}")
        return True
    except LLMUnavailableError as exc:
        print(f"[FAIL] Ollama service unavailable during generation: {exc}")
        if not model_present:
            print(f"       Hint: Model '{model}' may not be pulled. Run `ollama pull {model}`.")
        return False
    except LLMOutputError as exc:
        print(f"[FAIL] Ollama produced invalid output: {exc}")
        return False
    except Exception as exc:  # noqa: BLE001
        print(f"[FAIL] Generation error: {exc}")
        return False


def main() -> None:
    print("=" * 60)
    print("Skillio LLM Provider Chain Health Check")
    print(f"LLM_PROVIDER_CHAIN = '{settings.LLM_PROVIDER_CHAIN}'")
    print("=" * 60)

    raw_chain = settings.LLM_PROVIDER_CHAIN or ""
    providers = [p.strip().lower() for p in raw_chain.split(",") if p.strip()]

    if not providers:
        print("[FAIL] LLM_PROVIDER_CHAIN is empty. Set it in .env (e.g. LLM_PROVIDER_CHAIN=ollama).")
        sys.exit(1)

    success_count = 0

    for provider in providers:
        print(f"\n[Provider: {provider}]")
        if provider == "ollama":
            ok = check_ollama()
            if ok:
                success_count += 1
        elif provider == "gemini":
            if not settings.GEMINI_API_KEY:
                print("[SKIP] Gemini: GEMINI_API_KEY not configured.")
            else:
                print("[SKIP] Gemini: client not yet implemented in backend.")
        elif provider == "groq":
            if not settings.GROQ_API_KEY:
                print("[SKIP] Groq: GROQ_API_KEY not configured.")
            else:
                print("[SKIP] Groq: client not yet implemented in backend.")
        else:
            print(f"[SKIP] Unknown provider '{provider}'.")

    print("\n" + "=" * 60)
    if success_count > 0:
        print(f"Health check passed ({success_count} provider(s) responsive).")
        sys.exit(0)
    else:
        print("Health check completed with warnings or failures.")
        # Non-fatal if running in dev without ollama active
        sys.exit(0)


if __name__ == "__main__":
    main()
