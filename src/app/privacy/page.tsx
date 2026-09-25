"use client";

import Link from "next/link";
import { ArrowLeft} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppLogo } from "@/components/app-logo";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Какие данные мы собираем",
    body: [
      "Адрес электронной почты — при регистрации, для входа в аккаунт.",
      "Загружаемые вами документы (книги, файлы) и переписка с AI-ассистентом (вопросы, ответы, сгенерированные тесты) — чтобы предоставлять сервис.",
      "Страна — определяется автоматически по IP-адресу при входе, используется только в агрегированном виде для оценки спроса на приложение по регионам.",
      "Технические данные (тип браузера/устройства) — стандартные логи хостинга, для диагностики сбоев.",
    ],
  },
  {
    title: "Как мы используем данные",
    body: [
      "Для авторизации и работы вашего аккаунта.",
      "Загруженные документы и ваши вопросы передаются в OpenAI для генерации ответов ассистента и тестов на их основе — это необходимо для работы основной функции приложения.",
      "Мы не показываем рекламу и не продаём данные третьим лицам.",
      "Данные о стране (в агрегированном виде) используются, чтобы понять, в каких регионах приложением пользуются активнее.",
    ],
  },
  {
    title: "Где хранятся данные",
    body: [
      "База данных и файлы — в Supabase, с ограничением доступа: каждый пользователь видит только свои данные (Row Level Security).",
      "Хостинг сайта — Vercel.",
      "Обработка текста и документов — OpenAI API.",
    ],
  },
  {
    title: "Оплата",
    body: [
      "Оплата подписки обрабатывается через Click.uz (в браузере) или Google Play Billing (в приложении из Google Play).",
      "Мы не получаем и не храним номера банковских карт — эти данные обрабатываются платёжным провайдером напрямую.",
    ],
  },
  {
    title: "Хранение и удаление данных",
    body: [
      "Данные хранятся, пока ваш аккаунт активен.",
      "Чтобы удалить аккаунт и все связанные с ним данные, напишите нам на email ниже — мы удалим их в разумный срок.",
    ],
  },
  {
    title: "Дети",
    body: [
      "Приложение не предназначено для детей младше 13 лет, и мы сознательно не собираем данные таких пользователей.",
    ],
  },
  {
    title: "Изменения политики",
    body: [
      "Мы можем обновлять эту политику. Актуальная версия всегда доступна по этому адресу.",
    ],
  },
  {
    title: "Контакты",
    body: [
      "По всем вопросам, связанным с данными и конфиденциальностью, пишите: shakhmatovap@gmail.com",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--color-card-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "color-mix(in srgb, var(--color-background) 88%, transparent)" }}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/" style={{ width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-card)", border: "1px solid var(--color-card-border)", color: "var(--color-muted)", textDecoration: "none", flexShrink: 0 }}>
              <ArrowLeft size={18} />
            </Link>
            <AppLogo size={32} radius={10} />
            <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--color-foreground)" }}>KnowledgeAI</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="page-container" style={{ maxWidth: "720px" }}>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, color: "var(--color-foreground)", marginBottom: "8px" }}>Политика конфиденциальности</h1>
        <p style={{ fontSize: "13px", color: "var(--color-muted)", marginBottom: "36px" }}>Последнее обновление: 30 июля 2026</p>

        {SECTIONS.map((s) => (
          <div key={s.title} style={{ marginBottom: "28px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-foreground)", marginBottom: "10px" }}>{s.title}</h2>
            <ul style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "20px", margin: 0 }}>
              {s.body.map((line) => (
                <li key={line} style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-muted)" }}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </main>
    </div>
  );
}
