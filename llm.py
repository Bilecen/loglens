"""
LLM yorumlama katmanı. SADECE yeni gruplar için çalışır.
provider = "claude" -> Anthropic API
provider = "local"  -> LM Studio / Ollama (OpenAI uyumlu endpoint)

Çıktı her iki yolda da aynı JSON şemasında: title, source, severity, summary.
"""
import json
import httpx
import settings_store

def _system_prompt(language: str) -> str:
    """title/summary'nin üretileceği dil Ayarlar'dan (response_language) gelir — tüm ekip
    için tek ve global bir seçimdir."""
    return (
        "Sen bir hata analiz asistanısın. Sana bir uygulama/crash logu verilecek. "
        "Yanıtını SADECE geçerli JSON olarak ver, başka hiçbir metin yazma. "
        "Şema: {\"title\": kısa okunur başlık, "
        "\"source\": hatanın olası kaynağı (ekran/modül/servis adı), "
        "\"origin\": hatanın kaynak katmanı, SADECE şu değerlerden biri: "
        "\"mobile\" (Android/iOS istemci uygulaması), "
        "\"web\" (tarayıcı/web istemcisi), "
        "\"service\" (backend/API/sunucu tarafı), "
        "\"unknown\" (belirsizse). "
        "Karar için stack trace'e bak: Kotlin/Java/Swift/Activity/Fragment -> mobile; "
        "JS/React/tarayıcı -> web; sunucu/DB/HTTP 5xx/timeout kaynağı backend ise -> service. "
        "\"severity\": \"low\"|\"medium\"|\"high\"|\"critical\", "
        "\"summary\": olası kök neden ve kısa açıklama}. "
        f"ÇOK ÖNEMLİ: title ve summary alanlarını HER ZAMAN {language} dilinde yaz. "
        f"Log başka bir dilde olsa bile açıklamayı {language} dilinde üret; teknik terimler "
        f"(exception adı vb.) kalabilir ama cümleler {language} olmalı. Başka dilde cümle YAZMA."
    )


def _build_prompt(template: str, platform: str | None = None,
                  source: str | None = None) -> str:
    hint = f"\n\n(İstemci platformu ipucu: {platform})" if platform else ""
    src = (
        "\n\nİlgili kaynak kod (hatanın geçtiği satır '>' ile işaretli):\n"
        f"```\n{source}\n```\n"
        "Analizinde bu koda dayan: gerçek kök nedeni kod üzerinden açıkla."
    ) if source else ""
    return f"Aşağıdaki hatayı analiz et ve JSON döndür:\n\n{template}{hint}{src}"


def _parse(text: str) -> dict:
    """Modelin çıktısını JSON'a çevir. Kod bloğu işaretlerini temizle, hata olursa güvenli dön."""
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Metin içinde ilk { ... } bloğunu yakalamayı dene
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end != -1:
            try:
                data = json.loads(cleaned[start:end + 1])
            except json.JSONDecodeError:
                data = {}
        else:
            data = {}
    origin = (data.get("origin") or "").strip().lower()
    if origin not in {"mobile", "web", "service"}:
        origin = "unknown"
    return {
        "title": data.get("title") or "Sınıflandırılmamış hata",
        "source": data.get("source"),
        "origin": origin,
        "severity": data.get("severity") or "medium",
        "summary": data.get("summary"),
    }


async def _via_claude(cfg: dict, template: str, platform: str | None, source: str | None) -> dict:
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=cfg["anthropic_api_key"])
    resp = await client.messages.create(
        model=cfg["claude_model"],
        max_tokens=1024,
        system=_system_prompt(cfg["response_language"]),
        messages=[{"role": "user", "content": _build_prompt(template, platform, source)}],
    )
    return _parse(resp.content[0].text)


async def _via_openai_compat(base_url: str, model: str, api_key: str, language: str,
                             template: str, platform: str | None, source: str | None) -> dict:
    """LM Studio & Ollama gibi OpenAI uyumlu /chat/completions endpoint'leri."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json={
                "model": model,
                "temperature": 0.2,
                "messages": [
                    {"role": "system", "content": _system_prompt(language)},
                    {"role": "user", "content": _build_prompt(template, platform, source)},
                ],
            },
        )
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
    return _parse(text)


async def interpret(template: str, platform: str | None = None,
                    source: str | None = None, provider: str | None = None) -> dict:
    cfg = await settings_store.effective()
    provider = provider or cfg["llm_provider"]   # provider verilirse (ikinci görüş) onu kullan
    lang = cfg["response_language"]
    if provider == "claude":
        model = cfg["claude_model"]
        result = await _via_claude(cfg, template, platform, source)
    elif provider == "ollama":
        model = cfg["ollama_model"]
        result = await _via_openai_compat(cfg["ollama_base_url"], model, "", lang, template, platform, source)
    elif provider == "openai":
        model = cfg["openai_model"]
        result = await _via_openai_compat(cfg["openai_base_url"], model, cfg["openai_api_key"], lang, template, platform, source)
    elif provider == "gemini":
        model = cfg["gemini_model"]
        result = await _via_openai_compat(cfg["gemini_base_url"], model, cfg["gemini_api_key"], lang, template, platform, source)
    else:
        model = cfg["local_model"]
        result = await _via_openai_compat(cfg["local_base_url"], model, cfg["local_api_key"], lang, template, platform, source)
    result["llm_model"] = model
    return result