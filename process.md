# Tauri + React + TypeScript 앱 안전 설치 가이드 (에러 없는 구성)

> 이 문서는 Claude Config Editor를 Electron이 아닌 **Tauri 기반**으로 안정적으로 실행하기 위한 환경을 설정하는 방법을 다룹니다.

---

## 1. ❌ 가장 많이 나는 에러 원인

| 원인 | 설명 |
|------|------|
| Rust toolchain 문제 | Rustup 무제가 들어있거나 복사된 Rust 경로 충돌 |
| Node.js/공유 문제 | Node, Tauri CLI, Vite 버전이 바이러스에 따라 다르면 업설 시 여부 오류 |
| 파일 여부 권한 | macOS의 sandbox 보안차례로 fs 등 권한 문제 발생 |

---

## 2. ✔ 최신 패키지 / toolchain 설치

### 1) Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update
```

### 2) Node.js (권장: 18.x 또는 20.x LTS)
```bash
nvm install 18
nvm use 18
```

### 3) 최신 Tauri CLI 설치
```bash
npm install -g create-tauri-app
```

---

## 3. ✨ 개발 포럼 생성 (Vite + React + TypeScript)

### 상단 클릭
```bash
npm create tauri-app@latest
```

### 버전 선택:
- Template: `React`
- Language: `TypeScript`
- Package Manager: `npm`

---

## 4. 특수 설정 (fs, dialog, clipboard 권한)

`src-tauri/tauri.conf.json`

```json
"tauri": {
  "allowlist": {
    "fs": {
      "all": true,
      "scope": ["*"]
    },
    "dialog": {
      "all": true
    },
    "clipboard": {
      "readText": true,
      "writeText": true
    }
  },
  "security": {
    "csp": null
  },
  ...
}
```

---

## 5. 가장 안전한 복사 경로 조건

- React 프리엑스 경로: `src/` 또는 `src/pages` 구조
- `vite.config.ts`가 `src-tauri/` 보다 살아있는 경로로 설정

---

## 6. 테스트 방법

### 테스트 진행
```bash
npm install
npm run tauri dev
```

### 거의 확인 필요 패키지
```json
"dependencies": {
  "@tauri-apps/api": "^2.0.0-beta.6",
  "react": "^18.x",
  "vite": "^4.x"
}
```

---

## 7. 결론

> 이 경로로 설치하면 가장 가능성 높게 건설의 여부 오류 발생 없이 Tauri + React + TypeScript 경로를 구성 가능해지며,
> Rust과 의 가능한 충돌 발생 사전에 판단과 응답을 조치할 수 있도록 개발합니다.

다 구조되면, 현재 React 프로젝트와 연계하여 `invoke('read-file')`, `write-file`, `select-file` 같은 Tauri API를 이용해게 개발할 수 있습니다.

