"""Resend email integration — daily digest of top job matches."""
import os
import asyncio
import logging
import resend

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _job_card_html(j: dict, match: dict | None) -> str:
    score = match["score"] if match else None
    score_bg = "#D4F4E4" if score and score >= 80 else "#FFEACC" if score and score >= 55 else "#F8D7DA" if score else "#F6F4ED"
    score_color = "#0F5132" if score and score >= 80 else "#664D03" if score and score >= 55 else "#842029" if score else "#525252"
    score_html = f'<span style="background:{score_bg};color:{score_color};border:1.5px solid #1E1E1E;padding:6px 10px;font-weight:900;font-size:18px;font-family:Georgia,serif;">{score}/100</span>' if score else ""
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #1E1E1E;background:#fff;margin-bottom:16px;">
      <tr><td style="padding:16px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <span style="background:#D6E4F0;border:1.5px solid #1E1E1E;padding:3px 8px;font-size:11px;letter-spacing:2px;font-weight:600;text-transform:uppercase;">{j['source']}</span>
          </td>
          <td align="right">{score_html}</td>
        </tr></table>
        <h3 style="font-family:Georgia,serif;font-size:20px;margin:12px 0 4px;letter-spacing:-0.5px;color:#0A0A0A;">{j['title']}</h3>
        <div style="color:#525252;font-size:14px;margin-bottom:10px;">
          <strong style="color:#0A0A0A;">{j.get('company') or '—'}</strong> &middot; {j['location']}
          {f"&middot; <span style='font-family:monospace;font-size:12px;'>{j['salary']}</span>" if j.get('salary') else ''}
        </div>
        <a href="{j['url']}" style="background:#0A0A0A;color:#fff;border:1.5px solid #1E1E1E;padding:8px 14px;font-weight:700;font-size:13px;text-decoration:none;display:inline-block;">Apply on {j['source']} →</a>
      </td></tr>
    </table>
    """


def _digest_html(user_name: str, top_jobs: list) -> str:
    cards = "".join(_job_card_html(item["job"], item.get("match")) for item in top_jobs)
    return f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FDFBF7;font-family:Georgia,serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDFBF7;padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#FDFBF7;">
            <tr><td style="padding:0 24px 24px;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="background:#F2542D;border:1.5px solid #1E1E1E;width:28px;height:28px;"></td>
                <td style="font-family:Georgia,serif;font-size:24px;font-weight:900;letter-spacing:-1px;padding-left:8px;">ApplyMate<span style="color:#F2542D;">.AU</span></td>
              </tr></table>
              <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#525252;margin:24px 0 4px;font-weight:600;">Your daily digest</p>
              <h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.1;letter-spacing:-1.5px;margin:0 0 8px;">Hey {user_name.split(' ')[0]}, here are your top {len(top_jobs)} matches today.</h1>
              <p style="color:#525252;font-size:14px;">Freshly pulled in the last 12 hours from SEEK, LinkedIn, Indeed, Adzuna AU, Jora, Workforce Australia and more — scored against your resumes by Claude Sonnet 4.5.</p>
            </td></tr>
            <tr><td style="padding:0 24px;">
              {cards}
            </td></tr>
            <tr><td style="padding:24px;border-top:1.5px solid #1E1E1E;background:#F6F4ED;text-align:center;font-size:12px;color:#525252;">
              ApplyMate.AU &middot; Built for Australian job seekers
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>"""


async def send_digest_email(to_email: str, user_name: str, top_jobs: list) -> dict:
    """top_jobs: list of {"job": job_dict, "match": match_dict_or_None}"""
    if not RESEND_API_KEY:
        return {"status": "skipped", "reason": "RESEND_API_KEY not configured"}
    if not top_jobs:
        return {"status": "skipped", "reason": "no jobs to send"}
    html = _digest_html(user_name, top_jobs)
    params = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": f"🚀 {len(top_jobs)} fresh AU jobs matched to your resume",
        "html": html,
    }
    try:
        res = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "sent", "email_id": res.get("id"), "to": to_email}
    except Exception as e:
        logger.error("Resend send failed: %s", e, exc_info=True)
        return {"status": "error", "reason": str(e)}
