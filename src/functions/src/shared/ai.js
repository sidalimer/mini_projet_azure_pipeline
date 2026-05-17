'use strict';

const { AzureOpenAI } = require('openai');

const FALLBACK_KEYWORDS = [
    { match: /(^|[_\W])cv($|[_\W])/i, tags: ['cv', 'rh'] },
    { match: /resume/i, tags: ['cv', 'rh'] },
    { match: /facture|invoice/i, tags: ['facture', 'finance'] },
    { match: /devis|quote/i, tags: ['devis', 'commercial'] },
    { match: /contrat|contract/i, tags: ['contrat', 'juridique'] },
    { match: /azure/i, tags: ['azure', 'cloud'] },
    { match: /aws/i, tags: ['aws', 'cloud'] },
    { match: /gcp|google.?cloud/i, tags: ['gcp', 'cloud'] },
    { match: /rapport|report/i, tags: ['rapport'] },
    { match: /\.pdf$/i, tags: ['pdf'] },
    { match: /\.docx?$/i, tags: ['word', 'document'] },
    { match: /\.xlsx?$/i, tags: ['excel', 'tableur'] },
    { match: /\.pptx?$/i, tags: ['powerpoint', 'presentation'] },
    { match: /\.png$|\.jpe?g$|\.gif$/i, tags: ['image'] }
];

function fallbackTags(fileName) {
    const tags = new Set(['document']);
    for (const rule of FALLBACK_KEYWORDS) {
        if (rule.match.test(fileName)) {
            for (const t of rule.tags) tags.add(t);
        }
    }
    const words = fileName
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, '')
        .split(/[^a-z0-9]+/)
        .filter(w => w && w.length >= 3 && w.length <= 16);
    for (const w of words.slice(0, 4)) tags.add(w);
    return Array.from(tags).slice(0, 8);
}

function parseTags(raw) {
    if (!raw) return null;
    const cleaned = String(raw)
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            const tags = parsed
                .map(t => String(t).toLowerCase().trim())
                .filter(t => t && t.length <= 32);
            if (tags.length > 0) return Array.from(new Set(tags)).slice(0, 8);
        }
    } catch (_) {
        // not valid JSON, try to extract a bracketed array
        const match = cleaned.match(/\[[^\]]*\]/);
        if (match) {
            try {
                const arr = JSON.parse(match[0]);
                if (Array.isArray(arr)) {
                    return arr.map(t => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 8);
                }
            } catch (_) { /* ignore */ }
        }
    }
    return null;
}

async function generateTagsWithAzureOpenAI(fileName, logger) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';

    if (!endpoint || !apiKey || !deployment) {
        logger?.warn?.('[ai] Azure OpenAI not configured, using rule-based fallback.');
        return null;
    }

    const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

    const prompt = `Analyse le nom de fichier suivant et génère entre 3 et 8 tags courts en français.
Nom du fichier : ${fileName}

Retourne uniquement un tableau JSON de chaînes de caractères, sans texte additionnel.`;

    const response = await client.chat.completions.create({
        model: deployment,
        messages: [
            { role: 'system', content: 'Tu es un assistant qui produit uniquement du JSON valide.' },
            { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 200
    });

    const content = response?.choices?.[0]?.message?.content;
    return parseTags(content);
}

async function generateTags(fileName, logger) {
    try {
        const tags = await generateTagsWithAzureOpenAI(fileName, logger);
        if (tags && tags.length > 0) {
            return { tags, source: 'azure-openai' };
        }
        logger?.warn?.('[ai] Empty AI response, falling back to rules.');
    } catch (err) {
        logger?.error?.('[ai] Azure OpenAI call failed:', err?.message || err);
    }
    return { tags: fallbackTags(fileName), source: 'fallback-rules' };
}

module.exports = { generateTags, fallbackTags, parseTags };
