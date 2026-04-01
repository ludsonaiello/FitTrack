# Sprint 3 — Frontend Agent Spec
**Agent:** frontend-agent  
**Task ID:** #4  
**Gate:** BLOCKED until `fittrack-specs/sprint-03-i18n/BACKEND_GATE_OPEN` exists (Task #3 complete).

---

## Pre-Start Check

Before doing ANY work, verify:
```bash
cat fittrack-specs/sprint-03-i18n/BACKEND_GATE_OPEN
```
If the file does not exist, STOP. The backend agent has not finished. Do not proceed.

---

## Objective

Install react-i18next, create full translation files for all UI strings in both `en` and `pt-BR`, and wire language selection to the server so the preference persists across devices.

---

## Deliverables

### 1. Install Dependencies

Add to `/client/package.json` dependencies:
```json
"i18next": "^23.x",
"react-i18next": "^14.x"
```

Run: `npm install` in `/client/`

### 2. i18next Configuration

Create `/client/src/i18n/index.js`:
```js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ptBR from './pt-BR.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'pt-BR': { translation: ptBR },
  },
  lng: localStorage.getItem('ft_language') ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
```

### 3. Translation Files

Create `/client/src/i18n/en.json` — cover EVERY user-facing string in the app.

Key namespaces to cover:

```json
{
  "nav": {
    "home": "Home",
    "exercises": "Exercises",
    "planner": "Planner",
    "progress": "Progress",
    "profile": "Profile"
  },
  "auth": {
    "login": "Log In",
    "register": "Create Account",
    "logout": "Log Out",
    "email": "Email",
    "password": "Password",
    "name": "Full Name",
    "remember_me": "Remember me",
    "forgot_password": "Forgot password?",
    "no_account": "Don't have an account?",
    "have_account": "Already have an account?"
  },
  "onboarding": {
    "welcome": "Welcome to FitTrack",
    "step_name": "What's your name?",
    "step_unit": "Preferred weight unit",
    "step_weight": "Current body weight",
    "step_sex": "Biological sex",
    "step_height": "Your height",
    "step_goal": "Your primary goal",
    "step_language": "Preferred language",
    "next": "Next",
    "back": "Back",
    "finish": "Let's go!"
  },
  "dashboard": {
    "greeting_morning": "Good morning",
    "greeting_afternoon": "Good afternoon",
    "greeting_evening": "Good evening",
    "streak": "day streak",
    "no_plan": "No active plan",
    "start_workout": "Start Workout",
    "recent_sessions": "Recent Sessions"
  },
  "exercises": {
    "title": "Exercise Library",
    "search": "Search exercises...",
    "filter": "Filter",
    "no_results": "No exercises found",
    "all_equipment": "All Equipment",
    "all_focus": "All Focus Areas"
  },
  "planner": {
    "title": "Weekly Planner",
    "new_plan": "New Plan",
    "plan_name": "Plan name",
    "add_exercise": "Add Exercise",
    "rest_day": "Rest Day",
    "save_plan": "Save Plan",
    "delete_plan": "Delete Plan",
    "activate": "Set as Active"
  },
  "workout": {
    "title": "Active Workout",
    "finish": "Finish Workout",
    "rest_timer": "Rest Timer",
    "set": "Set",
    "reps": "Reps",
    "weight": "Weight",
    "duration": "Duration",
    "add_set": "Add Set",
    "skip": "Skip",
    "complete": "Complete"
  },
  "progress": {
    "title": "Progress",
    "body_weight": "Body Weight",
    "personal_records": "Personal Records",
    "goals": "Goals",
    "log_weight": "Log Weight",
    "add_goal": "Add Goal",
    "no_data": "No data yet"
  },
  "profile": {
    "title": "Profile",
    "settings": "Settings",
    "weight_unit": "Weight Unit",
    "language": "Language",
    "sex": "Biological Sex",
    "height": "Height",
    "account": "Account",
    "logout": "Log Out",
    "save": "Save",
    "saved": "Saved!",
    "male": "Male",
    "female": "Female",
    "unspecified": "Prefer not to say"
  },
  "goals": {
    "weight": "Reach goal weight",
    "frequency": "Work out {{count}} times per week",
    "exercise_pr": "Set a personal record on {{exercise}}"
  },
  "common": {
    "cancel": "Cancel",
    "delete": "Delete",
    "confirm": "Confirm",
    "loading": "Loading...",
    "error": "Something went wrong",
    "retry": "Try again",
    "save": "Save",
    "edit": "Edit",
    "back": "Back",
    "close": "Close",
    "kg": "kg",
    "lbs": "lbs",
    "cm": "cm",
    "ft": "ft"
  }
}
```

Create `/client/src/i18n/pt-BR.json` with ALL the same keys translated to Brazilian Portuguese.

### 4. Wire i18n to App

**File:** `/client/src/main.jsx`  
Import i18n config at the top (before React renders):
```js
import './i18n/index.js';
```

### 5. Update AuthContext to Apply Language

**File:** `/client/src/context/AuthContext.jsx`

After login or on user fetch, apply the user's language:
```js
import i18n from '../i18n/index.js';
// ...
// When user is loaded:
if (user.language) {
  i18n.changeLanguage(user.language);
  localStorage.setItem('ft_language', user.language);
}
```

### 6. Create useLanguage Hook

Create `/client/src/hooks/useLanguage.js`:
```js
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { api } from '../lib/api.js';
import i18n from '../i18n/index.js';

export function useLanguage() {
  const { i18n: i18nInstance } = useTranslation();

  const changeLanguage = useCallback(async (lang) => {
    await i18nInstance.changeLanguage(lang);
    localStorage.setItem('ft_language', lang);
    // Persist to server
    await api.patch('/api/auth/me', { language: lang });
  }, [i18nInstance]);

  return { language: i18nInstance.language, changeLanguage };
}
```

### 7. Add Language Selector to Profile Page

**File:** `/client/src/pages/Profile.jsx`

Add a language selector section using `useLanguage()` hook. Show two options: English and Português (Brasil). On change, call `changeLanguage(lang)`.

### 8. Add Language Step to Onboarding

**File:** `/client/src/components/Onboarding.jsx`

Add a language selection step (step 7 or step 1 — language should come FIRST so the rest of onboarding renders in the chosen language). Show flag + language name buttons.

### 9. Convert All Components to use `t()`

Replace every hardcoded English string in all `.jsx` files under `/client/src/pages/` and `/client/src/components/` with `const { t } = useTranslation()` + `t("key")`.

Priority order:
1. `App.jsx` — nav labels
2. `Dashboard.jsx`
3. `Login.jsx`
4. `Onboarding.jsx`
5. `Profile.jsx`
6. `ExerciseLibrary.jsx`
7. `Planner.jsx`
8. `ActiveWorkout.jsx`
9. `Progress.jsx`
10. `Sessions.jsx`
11. `SessionDetail.jsx`
12. `ConfirmModal.jsx`
13. `SyncBadge.jsx`

---

## PWA Offline Considerations

The translation JSON files are bundled into the Vite build output — they will be cached by the service worker automatically. No additional Workbox config needed.

---

## Validation Checklist

- [ ] `i18next` and `react-i18next` installed in client/package.json
- [ ] `/client/src/i18n/index.js` created
- [ ] `/client/src/i18n/en.json` — all keys present
- [ ] `/client/src/i18n/pt-BR.json` — all keys translated
- [ ] `main.jsx` imports i18n config
- [ ] AuthContext applies `user.language` on login/fetch
- [ ] `useLanguage` hook exists
- [ ] Profile page has working language selector
- [ ] Onboarding has language step
- [ ] All pages use `t()` — no hardcoded English strings
- [ ] Switching language in Profile immediately updates all UI
- [ ] Language persists after page refresh (localStorage + server)
- [ ] Language persists after logout + login on another device (server)
