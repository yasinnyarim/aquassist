import os

import httpx

try:
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key) if api_key else None
except ImportError:
    client = None

import models
from typing import List

def calculate_bioload(tank: models.Tank, fishes: List[models.TankFish], plants: List[models.TankPlant] = []):
    total_bioload = 0.0
    for tf in fishes:
        species = tf.species
        if species:
            # sum(quantity x size x bioload_factor)
            total_bioload += tf.quantity * species.adult_size_cm * species.bioload_factor

    # Plants reduce bioload (nitrate reduction)
    plant_reduction = 0.0
    for tp in plants:
        if tp.plant:
            plant_reduction += tp.quantity * 2.5 # Each plant reduces bioload by 2.5 units
            
    total_bioload = max(0.0, total_bioload - plant_reduction)

    if tank.size_liters > 0:
        bioload_percent = (total_bioload / tank.size_liters) * 100
    else:
        bioload_percent = 0.0
        
    return total_bioload, bioload_percent

def calculate_compatibility(tank: models.Tank, fishes: List[models.TankFish]):
    issues = []
    
    species_list = [tf.species for tf in fishes if tf.species]
    aggression_levels = [s.aggression_level.lower() for s in species_list]
    sizes = [s.adult_size_cm for s in species_list]
    categories = [s.category.lower() for s in species_list if s.category]
    
    if "high" in aggression_levels and "low" in aggression_levels:
        issues.append("Aggressive fish mixed with peaceful fish.")
        
    if sizes:
        max_size = max(sizes)
        min_size = min(sizes)
        if max_size > min_size * 3:
            issues.append("Considerable size difference detected, potential predator-prey conflict.")

    if len(set(categories)) > 1:
        if "saltwater" in categories and "freshwater" in categories:
            issues.append("CRITICAL: Saltwater and freshwater fish cannot live together.")
            
    if tank.temperature:
        for s in species_list:
            if tank.temperature < s.min_temp or tank.temperature > s.max_temp:
                issues.append(f"Tank temperature ({tank.temperature}C) is outside bounds for {s.name} ({s.min_temp}-{s.max_temp}C).")
                
    return issues

def calculate_health_score(bioload_percent: float, issues: List[str], has_filter: bool):
    score = 100.0
    
    if bioload_percent > 100:
        score -= (bioload_percent - 100) * 0.5
    
    score -= len(issues) * 15
    
    if not has_filter:
        score -= 20
        
    score = max(0.0, score)
    score = min(100.0, score)
    
    status = "good"
    if score < 50:
        status = "danger"
    elif score < 80:
        status = "warning"
        
    return score, status

def generate_recommendations(bioload_percent: float, has_filter: bool, issues: List[str]) -> List[str]:
    actions: list[str] = []
    if bioload_percent > 100:
        actions.append("Derhal su değişimi yapın ve fazla balıkları başka bir tanka aktarmayı düşünün.")
    if not has_filter:
        actions.append("Acilen tank hacmine uygun bir filtre edinin ve sürekli çalıştırın.")
    if any("temperature" in i.lower() for i in issues):
        actions.append("Tank sıcaklığını balıkların ortak tolerans aralığına ayarlayın.")
    if any("compatibility" in i.lower() or "aggressive" in i.lower() for i in issues):
        actions.append("Tür uyumsuzluğu tespit edildi. Balıkları ayırmayı planlayın.")
        
    if not actions:
        actions.append("Mevcut dengeyi korumaya devam edin!")
        
    return actions

def generate_fallback_report(analysis_data: dict):
    bioload = analysis_data.get('bioload_percent', 0)
    score = analysis_data.get('health_score', 0)
    status = analysis_data.get('status', 'unknown')
    issues = analysis_data.get('compatibility_issues', [])
    has_filter = analysis_data.get('has_filter', True)
    
    status_tr = {"good": "İYİ", "warning": "DİKKAT", "danger": "TEHLİKELİ"}.get(status, "BİLİNMİYOR")
    
    report = f"📋 AKVARYUM DURUM RAPORU (Sistem Üretimi)\n"
    report += f"=========================================\n"
    report += f"🎯 ÖZET\n"
    report += f"Genel Sağlık Skoru: {score:.1f}/100 - Durum: {status_tr}\n"
    report += f"Doluluk Oranı (Biyolojik Yük): %{bioload:.1f}\n"
    report += f"Filtre Durumu: {'Mevcut' if has_filter else 'YOK (Kritik)'}\n\n"
    
    risks: list[str] = []
    if bioload > 100:
        risks.append("Akvaryum kapasitesinden fazla dolu! Şiddetli amonyak patlaması riski var.")
    elif bioload > 80:
        risks.append("Akvaryum doluluk sınırına yaklaşıyor. Filtrenin yükü arttı.")
        
    if not has_filter:
        risks.append("Akvaryumda filtre yok! Toksik madde birikimi balık kayıplarına yol açabilir.")
        
    for t in [i for i in issues if "temperature" in i.lower()]:
        risks.append(f"Sıcaklık uyumsuzluğu: {t}")
    for c in [i for i in issues if "temperature" not in i.lower()]:
        risks.append(f"Tür uyumsuzluğu: {c}")

    report += "⚠️ TEMEL RİSKLER\n"
    if risks:
        for r in risks:
            report += f"- {r}\n"
    else:
        report += "- Herhangi bir risk tespit edilmedi.\n"
    report += "\n"

    actions = analysis_data.get('recommendations', [])
    if not actions:
        actions = generate_recommendations(bioload, has_filter, issues)
        
    report += "💡 ÖNERİLEN AKSİYONLAR\n"
    for a in actions:
        report += f"- {a}\n"
    report += "\n"
        
    report += "📅 BAKIM TAVSİYELERİ\n"
    report += "- Haftalık olarak tank suyunun %20-30'unu dinlenmiş su ile değiştirin.\n"
    report += "- Balıklara 1-2 dakikada tüketebilecekleri kadar, günde 1-2 kez yem verin.\n"
    report += "- Filtre süngerlerini musluk suyuyla değil, akvaryumdan çektiğiniz atık suyla yıkayın.\n"
    
    return report

def generate_report_from_llm(analysis_data: dict):
    if not client:
        return generate_fallback_report(analysis_data)
    
    prompt = f"""
    Act as an expert aquarist. Review the following aquarium analysis data and generate a short, friendly explanation and a simple maintenance plan.
    Data:
    Bioload: {analysis_data.get('bioload_percent', 0)}%
    Health Score: {analysis_data.get('health_score', 0)}/100 ({analysis_data.get('status', 'unknown')})
    Issues: {', '.join(analysis_data.get('compatibility_issues', [])) if analysis_data.get('compatibility_issues', []) else 'None'}
    Recommendations: {', '.join(analysis_data.get('recommendations', [])) if analysis_data.get('recommendations', []) else 'None'}
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"OpenAI API failed: {e}")
        return generate_fallback_report(analysis_data)

def diagnose_problem(description: str):
    if not client:
        return "OpenAI library not found."
        
    prompt = f"""
    Act as an expert fish vet. A user is describing an issue with their aquarium or fish: "{description}".
    Analyze the problem and provide:
    1. Possible causes
    2. Urgency level
    3. Recommended actions
    Format neatly.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"LLM integration failed: {str(e)}"

def _build_chat_system_prompt(context: dict) -> str:
    """Rich tank context for Ollama / OpenAI (Turkish UI)."""
    tank = context.get("tank_name", "Akvaryum")
    vol = context.get("volume", "?")
    temp = context.get("temp")
    temp_s = f"{temp}°C" if temp is not None else "Belirtilmedi"
    has_f = "Evet" if context.get("has_filter", True) else "Hayır (kritik)"
    planted = "Evet" if context.get("is_planted") else "Hayır"
    bio = context.get("bioload_percent")
    score = context.get("health_score")
    status = context.get("health_status", "")
    bio_s = f"%{bio}" if bio is not None else "—"
    score_s = f"{score}/100" if score is not None else "—"
    fishes = context.get("fishes") or []
    plants = context.get("plants") or []
    issues = context.get("compatibility_issues") or []

    fish_lines = "\n".join(
        f"- {f['qty']} adet {f['name']}"
        + (f" (kategori: {f['category']})" if f.get("category") else "")
        for f in fishes
    ) or "- Henüz balık yok"
    plant_lines = "\n".join(f"- {p['qty']} adet {p['name']}" for p in plants) or "- Henüz bitki yok"
    issue_lines = "\n".join(f"- {i}" for i in issues) if issues else "- Uyumluluk uyarısı yok"

    return f"""Sen AquAssist adlı akvaryum asistanısın. Kullanıcı şu an yalnızca "{tank}" adlı akvaryumu seçmiş durumda; tüm soruları bu tankın verilerine göre yanıtla. Genel bilgi verirken bile bu tanka özel öneride bulun.

Seçili akvaryum verileri:
- Ad: {tank}
- Hacim: {vol} L
- Sıcaklık: {temp_s}
- Filtre: {has_f}
- Bitkili düzen: {planted}
- Tahmini biyolojik yük (doluluk): {bio_s}
- Sağlık skoru (uygulama hesabı): {score_s} (durum: {status})

Balıklar:
{fish_lines}

Bitkiler:
{plant_lines}

Uyumluluk / risk notları:
{issue_lines}

Kurallar: Türkçe yanıt ver. Kısa ve net ol; gerekirse madde madde yaz. Tıbbi teşhis yerine akvaryum bakımı perspektifinden konuş; ciddi balık hastalığı şüphesinde veteriner öner."""


def _ollama_chat(system: str, user_message: str) -> str:
    base = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama3.2")
    url = f"{base}/api/chat"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ],
        "stream": False,
        "options": {"temperature": 0.65},
    }
    timeout = httpx.Timeout(120.0, connect=8.0)
    with httpx.Client(timeout=timeout) as hc:
        r = hc.post(url, json=payload)
        r.raise_for_status()
        body = r.json()
    msg = body.get("message") or {}
    content = (msg.get("content") or "").strip()
    if not content:
        raise RuntimeError("Ollama boş yanıt döndü")
    return content


def _keyword_fallback_chat(message: str, context: dict) -> str:
    msg = message.lower()
    name = context.get("tank_name", "Akvaryum")
    if "selam" in msg or "merhaba" in msg:
        return f"Merhaba! {name} için size nasıl yardımcı olabilirim? (Not: Yerel Ollama veya OpenAI kapalı — tam yanıt için Ollama'yı başlatın.)"
    if "balık" in msg or "fish" in msg:
        n = len(context.get("fishes") or [])
        return f"{name} tankında şu an {n} tür balık kayıtlı."
    if "bitki" in msg or "plant" in msg:
        n = len(context.get("plants") or [])
        return f"{name} içinde {n} tür bitki kayıtlı."
    if "durum" in msg or "status" in msg:
        return f"{name}: {context.get('volume')} L, sıcaklık {context.get('temp')}°C. Tam analiz için Ollama bağlantısı gerekir."
    return "Yapay zeka şu an kullanılamıyor. Ollama'yı çalıştırıp tekrar deneyin."


def get_ai_chat_response(message: str, context: dict) -> str:
    system = _build_chat_system_prompt(context)
    use_ollama = os.getenv("OLLAMA_CHAT", "1").lower() not in ("0", "false", "no")

    if use_ollama:
        try:
            return _ollama_chat(system, message)
        except Exception as e:
            print(f"Ollama chat failed: {e}")
            if not client:
                model = os.getenv("OLLAMA_MODEL", "llama3.2")
                return (
                    "Ollama ile bağlantı kurulamadı. Bilgisayarınızda Ollama'nın çalıştığından emin olun "
                    f"(genelde `http://127.0.0.1:11434`). Model için: `ollama pull {model}`\n\n"
                    f"Detay: {str(e)}"
                )

    if client:
        try:
            response = client.chat.completions.create(
                model=os.getenv("OPENAI_CHAT_MODEL", "gpt-3.5-turbo"),
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": message},
                ],
                max_tokens=500,
            )
            out = (response.choices[0].message.content or "").strip()
            if out:
                return out
        except Exception as e:
            print(f"OpenAI chat failed: {e}")

    return _keyword_fallback_chat(message, context)
