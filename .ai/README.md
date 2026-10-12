# AI Operational Memory

`.ai` adalah memori operasional ringkas; dokumentasi teknis mendalam berada di [`docs/obsidian-vault`](../docs/obsidian-vault/00-HOME/Dashboard.md).

## Startup minimum
1. Baca `.agents/skills/caveman/SKILL.md`; gunakan untuk seluruh respons chat sampai pengguna menonaktifkannya secara eksplisit.
2. Baca [`STATUS.md`](STATUS.md), [`CONTEXT.md`](CONTEXT.md), dan [`AGENTS.md`](AGENTS.md).
3. Baca [`TASKS.md`](TASKS.md) dan [`handoffs/latest.md`](handoffs/latest.md).
4. Muat hanya note modul/API/database/flow yang relevan.
5. Verifikasi detail yang akan diubah terhadap source aktual.
6. Untuk pertanyaan teknologi/library, baca `.agents/skills/find-docs/SKILL.md` dan ambil dokumentasi aktual melalui Context7.

Prinsip: **Read minimum necessary context, verify against actual code, and expand only when required.**

## Struktur
- `CONTEXT.md`: ringkasan sistem.
- `STATUS.md`: kondisi aktual dan validasi terakhir.
- `PROGRESS.md`: pekerjaan selesai/berjalan.
- `DECISIONS.md`: keputusan aktif; detail tetap di Vault.
- `TASKS.md`: backlog operasional, bukan roadmap produk.
- `MEMORY.md`: fakta stabil dan jebakan penting.
- `context/`: progressive Level 1–2 context.
- `sessions/`: jejak sesi.
- `handoffs/latest.md`: titik lanjut sesi baru.
- `protocols/`: startup, tracking, sinkronisasi, completion.
- `source-manifest.json`: baseline hash untuk mendeteksi source drift.
- `.agents/skills/`: skills project-scoped; `caveman` wajib untuk respons chat.
- `skills-lock.json`: source dan hash instalasi skill.
- `.claude/rules/context7.md`: rule Context7 yang dipasang installer resmi.

## Entrypoint tool
- Codex: root `AGENTS.md` mengikuti format project instructions resmi.
- Claude Code: root `CLAUDE.md` mengikuti project memory resmi.
- Gemini CLI: root `GEMINI.md` mengikuti hierarchical context resmi.

Format diverifikasi terhadap dokumentasi resmi: [Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md), [Claude Code memory](https://docs.anthropic.com/en/docs/claude-code/memory), dan [Gemini CLI GEMINI.md](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md).
