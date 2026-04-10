# Data Model: Login Page

**Feature**: 002-login-page | **Date**: 2026-04-09

## Overview

No new database entities or schema changes required. This feature uses existing Better Auth tables for user and session management.

## Existing Entities (referenced, not modified)

### User

Managed by Better Auth via Drizzle ORM schema in `src/lib/schema.ts`.

| Field | Type | Notes |
|-------|------|-------|
| id | string | Primary key |
| name | string | From Google profile |
| email | string | From Google account |
| image | string | nullable | Google avatar URL |
| createdAt | timestamp | Auto-set |
| updatedAt | timestamp | Auto-update |

### Session

Managed by Better Auth.

| Field | Type | Notes |
|-------|------|-------|
| id | string | Primary key |
| userId | string | FK → User |
| token | string | Session token |
| expiresAt | timestamp | Session expiry |

### Account

Managed by Better Auth. Links Google OAuth to User.

| Field | Type | Notes |
|-------|------|-------|
| id | string | Primary key |
| userId | string | FK → User |
| providerId | string | "google" |
| accountId | string | Google account ID |
| accessToken | string | nullable | OAuth access token |

## State Transitions

```
Unauthenticated → [Click "Sign in with Google"] → Google OAuth → [Callback] → Authenticated (Session created)
Authenticated + Visit /login → [Server redirect] → /dashboard
```

## i18n Data (new keys)

### messages/en.json additions

```json
{
  "Header": {
    "login": "Login"
  },
  "LoginPage": {
    "title": "Welcome to PapayaClaw",
    "subtitle": "Sign in to manage your AI agents",
    "signInWithGoogle": "Sign in with Google",
    "securePrivateFree": "Secure · Private · Free"
  }
}
```

### messages/es.json additions

```json
{
  "Header": {
    "login": "Iniciar sesión"
  },
  "LoginPage": {
    "title": "Bienvenido a PapayaClaw",
    "subtitle": "Inicia sesión para gestionar tus agentes de IA",
    "signInWithGoogle": "Iniciar sesión con Google",
    "securePrivateFree": "Seguro · Privado · Gratis"
  }
}
```
