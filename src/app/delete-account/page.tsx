"use client";

import Link from "next/link";
import { ArrowLeft, Brain } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DeleteAccountPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--color-card-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "color-mix(in srgb, var(--color-background) 88%, transparent)" }}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/" style={{ width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-muted)", textDecoration: "none", flexShrink: 0 }}>
              <ArrowLeft size={18} />
            </Link>
            <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={16} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--color-foreground)" }}>KnowledgeAI</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="page-container" style={{ maxWidth: "720px" }}>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, color: "var(--color-foreground)", marginBottom: "8px" }}>Удаление аккаунта KnowledgeAI</h1>
        <p style={{ fontSize: "13px", color: "var(--color-muted)", marginBottom: "36px" }}>Последнее обновление: 4 августа 2026</p>

        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-foreground)", marginBottom: "10px" }}>Как удалить аккаунт</h2>
          <ol style={{ display: "flex", flexDirection: "column", gap: "10px", paddingLeft: "20px", margin: 0 }}>
            <li style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-muted)" }}>
              Напишите на <strong style={{ color: "var(--color-foreground)" }}>shakhmatovap@gmail.com</strong> с адреса электронной почты, на который зарегистрирован ваш аккаунт KnowledgeAI.
            </li>
            <li style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-muted)" }}>
              В теме письма укажите: <strong style={{ color: "var(--color-foreground)" }}>«Удалить аккаунт KnowledgeAI»</strong>.
            </li>
            <li style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-muted)" }}>
              Мы подтвердим запрос и удалим аккаунт в течение 30 дней.
            </li>
          </ol>
        </div>

        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-foreground)", marginBottom: "10px" }}>Какие данные удаляются</h2>
          <ul style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "20px", margin: 0 }}>
            <li style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-muted)" }}>Email и данные учётной записи</li>
            <li style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-muted)" }}>Загруженные документы и файлы</li>
            <li style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-muted)" }}>История переписки с AI-ассистентом и результаты тестов</li>
            <li style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-muted)" }}>Информация о подписке и платежах</li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-foreground)", marginBottom: "10px" }}>Что сохраняется</h2>
          <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-muted)" }}>
            Записи о завершённых платежах могут быть сохранены до 3 лет — это требование законодательства о бухгалтерском учёте. Все остальные данные удаляются полностью.
          </p>
        </div>
      </main>
    </div>
  );
}
