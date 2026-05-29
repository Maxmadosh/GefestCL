const crypto = require("node:crypto");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const checklist = payload.checklist || {};
  const siteId = checklist.object?.siteId;
  const siteName = checklist.object?.siteName;
  if (!siteId || !siteName) {
    return json(400, { ok: false, error: "Missing site data" });
  }

  const id = [
    "gcl",
    new Date().toISOString().slice(0, 10).replaceAll("-", ""),
    crypto.randomBytes(4).toString("hex")
  ].join("-");

  const record = {
    id,
    receivedAt: new Date().toISOString(),
    appVersion: payload.appVersion,
    channel: payload.channel,
    site: { id: siteId, name: siteName },
    brigadier: {
      name: checklist.profile?.brigadierFullName,
      phone: checklist.profile?.phone,
      company: checklist.profile?.contractorCompany
    },
    summary: payload.summary,
    message: payload.message,
    checklist,
    pdfHtml: payload.pdfHtml,
    excelHtml: payload.excelHtml
  };

  const deliveries = [];
  const telegramResult = await sendTelegram(record);
  if (telegramResult.configured) deliveries.push(telegramResult);

  const webhookResult = await forwardWebhook(record);
  if (webhookResult.configured) deliveries.push(webhookResult);

  const sentDeliveries = deliveries.filter((delivery) => delivery.ok);
  if (sentDeliveries.length) {
    return json(200, {
      ok: true,
      id,
      deliveries: sentDeliveries.map((delivery) => delivery.channel)
    });
  }

  if (!deliveries.length) {
    return json(503, {
      ok: false,
      id,
      error: "No delivery channel is configured",
      preview: publicPreview(record)
    });
  }

  return json(502, {
    ok: false,
    id,
    error: deliveries.map((delivery) => `${delivery.channel}: ${delivery.error}`).join("; "),
    preview: publicPreview(record)
  });
};

async function sendTelegram(record) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { configured: false, channel: "telegram" };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      text: telegramText(record)
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { configured: true, ok: false, channel: "telegram", error: `HTTP ${response.status} ${body}`.trim() };
  }

  return { configured: true, ok: true, channel: "telegram" };
}

async function forwardWebhook(record) {
  const webhookUrl = process.env.REPORT_WEBHOOK_URL;
  if (!webhookUrl) return { configured: false, channel: "webhook" };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record)
  });

  if (!response.ok) return { configured: true, ok: false, channel: "webhook", error: `HTTP ${response.status}` };
  return { configured: true, ok: true, channel: "webhook" };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

function publicPreview(record) {
  return {
    id: record.id,
    receivedAt: record.receivedAt,
    site: record.site,
    brigadier: record.brigadier,
    summary: record.summary
  };
}

function telegramText(record) {
  const checklist = record.checklist || {};
  const mileage = checklist.mileage || {};
  const photos = Array.isArray(checklist.photos) ? checklist.photos : [];
  const attachedPhotos = photos.filter((photo) => photo.attached).length;
  const text = [
    `<b>Gefest Cl</b>`,
    `<b>${escapeTelegram(record.site.id)} · ${escapeTelegram(record.site.name)}</b>`,
    ``,
    `ID отчета: <code>${escapeTelegram(record.id)}</code>`,
    `Бригадир: ${escapeTelegram(record.brigadier.name || "-")} · ${escapeTelegram(record.brigadier.phone || "-")}`,
    `Организация: ${escapeTelegram(record.brigadier.company || "-")}`,
    `Тип работ: ${escapeTelegram(checklist.object?.workType || "-")}`,
    `Пробег: ${escapeTelegram(mileage.totalKm || "-")} км`,
    `Маршрут: ${escapeTelegram(mileage.departurePoint || "-")} → ${escapeTelegram(mileage.objectDestination || "-")} → ${escapeTelegram(mileage.returnDestination || "-")}`,
    `Фото: ${attachedPhotos}/${photos.length}`,
    `Материалы: ${Array.isArray(checklist.materials) ? checklist.materials.length : 0} позиций`,
    `Расхождения: ${Array.isArray(checklist.deliveryMismatches) ? checklist.deliveryMismatches.length : 0}`,
    ``,
    escapeTelegram(record.message || "")
  ].join("\n");

  return text.length > 3900 ? `${text.slice(0, 3900)}\n...` : text;
}

function escapeTelegram(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
