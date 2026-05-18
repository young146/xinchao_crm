/**
 * 씬짜오베트남 광고 안내 AI 챗봇 위젯
 * chatbot-widget.js — Vanilla JS, Shadow DOM, 번들러 불필요
 *
 * 삽입 방법:
 * <script src="https://your-domain.com/chatbot-widget.js"
 *         data-api-url="https://your-crm-domain.vercel.app/api/chat"></script>
 */
(function () {
  'use strict';

  /* ── 설정 ──────────────────────────────────────────────── */
  const SCRIPT_TAG = document.currentScript || (function () {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const API_URL = (SCRIPT_TAG && SCRIPT_TAG.getAttribute('data-api-url'))
    || '/api/chat';

  const GREETING = '안녕하세요! 무엇을 도와드릴까요? 아래 질문을 선택하거나 자유롭게 물어보세요.';

  /* ── CSS ────────────────────────────────────────────────── */
  const CSS = `
    :host {
      all: initial;
      font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }

    /* 플로팅 버튼 */
    #xv-fab {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #d32f2f;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(211,47,47,0.45), 0 2px 6px rgba(0,0,0,0.2);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
      outline: none;
      position: relative;
    }
    #xv-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 22px rgba(211,47,47,0.55), 0 3px 10px rgba(0,0,0,0.25);
    }
    #xv-fab:active { transform: scale(0.96); }
    #xv-fab svg { width: 26px; height: 26px; fill: #fff; }

    /* 알림 뱃지 */
    #xv-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 16px;
      height: 16px;
      background: #ff6b35;
      border-radius: 50%;
      border: 2px solid #fff;
      display: none;
    }
    #xv-badge.show { display: block; }

    /* 채팅창 컨테이너 */
    #xv-window {
      position: fixed;
      bottom: 92px;
      right: 24px;
      z-index: 2147483639;
      width: 400px;
      max-width: calc(100% - 48px);
      height: 520px;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18), 0 2px 12px rgba(0,0,0,0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform-origin: bottom right;
      transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease;
    }
    #xv-window.xv-hidden {
      transform: scale(0.82) translateY(12px);
      opacity: 0;
      pointer-events: none;
    }

    /* 헤더 */
    #xv-header {
      background: #d32f2f;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    #xv-header-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(255,255,255,0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #xv-header-avatar svg { width: 18px; height: 18px; fill: #fff; }
    #xv-header-info { flex: 1; min-width: 0; }
    #xv-header-title {
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #xv-header-sub {
      color: rgba(255,255,255,0.75);
      font-size: 11px;
      margin-top: 1px;
    }
    #xv-close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    #xv-close:hover { background: rgba(255,255,255,0.18); }
    #xv-close svg { width: 18px; height: 18px; stroke: #fff; fill: none; }

    /* 메시지 영역 */
    #xv-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #fafafa;
      scroll-behavior: smooth;
    }
    #xv-messages::-webkit-scrollbar { width: 4px; }
    #xv-messages::-webkit-scrollbar-track { background: transparent; }
    #xv-messages::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 2px; }

    /* 메시지 버블 */
    .xv-msg-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }
    .xv-msg-row.xv-user { flex-direction: row-reverse; }
    .xv-bot-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #d32f2f;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .xv-bot-avatar svg { width: 14px; height: 14px; fill: #fff; }
    .xv-bubble {
      max-width: 72%;
      padding: 10px 13px;
      border-radius: 16px;
      font-size: 13.5px;
      line-height: 1.55;
      word-break: keep-all;
      overflow-wrap: break-word;
    }
    .xv-msg-row.xv-bot .xv-bubble {
      background: #fff;
      color: #1a1a1a;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .xv-msg-row.xv-user .xv-bubble {
      background: #d32f2f;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .xv-bubble strong { font-weight: 700; }

    /* 타임스탬프 */
    .xv-time {
      font-size: 10px;
      color: #bbb;
      align-self: flex-end;
      margin-bottom: 2px;
      flex-shrink: 0;
    }

    /* 타이핑 인디케이터 */
    .xv-typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
    }
    .xv-typing span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #ccc;
      display: inline-block;
      animation: xvBounce 1.1s infinite ease-in-out;
    }
    .xv-typing span:nth-child(2) { animation-delay: 0.18s; }
    .xv-typing span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes xvBounce {
      0%, 80%, 100% { transform: translateY(0); background: #ccc; }
      40% { transform: translateY(-5px); background: #d32f2f; }
    }

    /* 추천 버튼 */
    .xv-rec-card {
      background: #fff5f5;
      border: 1.5px solid #d32f2f;
      border-radius: 12px;
      padding: 12px 14px;
      margin-top: 6px;
    }
    .xv-rec-label {
      font-size: 11px;
      color: #d32f2f;
      font-weight: 700;
      letter-spacing: 0.03em;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    .xv-rec-pkg {
      font-size: 14px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 3px;
    }
    .xv-rec-detail {
      font-size: 12px;
      color: #666;
      margin-bottom: 10px;
    }
    .xv-rec-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #d32f2f;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 9px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, transform 0.1s;
    }
    .xv-rec-btn:hover { background: #b71c1c; }
    .xv-rec-btn:active { transform: scale(0.97); }
    .xv-rec-btn svg { width: 14px; height: 14px; fill: #fff; }
    .xv-rec-btn-quote { background: #fff; color: #d32f2f; border: 1.5px solid #d32f2f; margin-top: 6px; }
    .xv-rec-btn-quote:hover { background: #fff5f5; }

    /* 입력 영역 */
    #xv-input-area {
      padding: 10px 12px 12px;
      background: #fff;
      border-top: 1px solid #f0f0f0;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      flex-shrink: 0;
      min-width: 0;
    }
    #xv-input {
      flex: 1;
      min-width: 0;
      border: 1.5px solid #e8e8e8;
      border-radius: 12px;
      padding: 9px 13px;
      font-size: 13.5px;
      font-family: inherit;
      resize: none;
      outline: none;
      line-height: 1.45;
      min-height: 40px;
      max-height: 110px;
      overflow-y: auto;
      transition: border-color 0.15s;
      background: #fafafa;
      color: #1a1a1a;
    }
    #xv-input:focus { border-color: #d32f2f; background: #fff; }
    #xv-input::placeholder { color: #b0b0b0; }
    #xv-send {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #d32f2f;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, transform 0.1s;
      flex-shrink: 0;
    }
    #xv-send:hover { background: #b71c1c; }
    #xv-send:active { transform: scale(0.94); }
    #xv-send:disabled { background: #e0e0e0; cursor: default; }
    #xv-send svg { width: 17px; height: 17px; fill: #fff; }

    /* 에러 배너 */
    .xv-error {
      background: #fff0f0;
      border: 1px solid #ffcdd2;
      color: #c62828;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12.5px;
      text-align: center;
    }

    /* FAB 라벨 */
    #xv-fab-wrapper {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483640;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-direction: row-reverse;
    }
    #xv-fab {
      position: static;
      z-index: auto;
      flex-shrink: 0;
    }
    #xv-fab-label {
      background: #fff;
      color: #d32f2f;
      font-size: 13px;
      font-weight: 700;
      padding: 7px 14px;
      border-radius: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      white-space: nowrap;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.4s ease;
    }
    #xv-fab-label.xv-label-hidden {
      opacity: 0;
    }

    /* 대화창이 열렸을 때 플로팅 아이콘 숨김 (메시지 가림 방지) */
    :host(.xv-is-open) #xv-fab-wrapper {
      display: none;
    }

    /* 추천 질문 버튼 */
    #xv-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
      padding: 0 2px;
    }
    .xv-sug-btn {
      flex: 1 1 calc(50% - 4px);
      min-width: 120px;
      background: #fff;
      color: #d32f2f;
      border: 1.5px solid #d32f2f;
      border-radius: 20px;
      padding: 7px 12px;
      font-size: 12.5px;
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      line-height: 1.4;
      transition: background 0.15s, color 0.15s;
      word-break: keep-all;
    }
    .xv-sug-btn:hover {
      background: #d32f2f;
      color: #fff;
    }
    .xv-sug-btn:active {
      background: #b71c1c;
      color: #fff;
    }

    /* 모바일 반응형 */
    @media (max-width: 480px) {
      #xv-window {
        bottom: 0 !important;
        right: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        height: 100dvh !important;
        border-radius: 0 !important;
        overflow-x: hidden;
      }
      #xv-window.xv-hidden {
        transform: translateY(100%) !important;
      }
      #xv-fab-wrapper {
        bottom: 16px;
        right: 16px;
      }
    }
  `;

  /* ── 아이콘 SVG ──────────────────────────────────────────── */
  const ICON_CHAT = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 11H7v-2h10v2zm0-3H7V8h10v2z"/></svg>`;
  const ICON_CLOSE = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const ICON_SEND = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
  const ICON_BOT = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 9V7c0-1.1-.9-2-2-2h-3V3H9v2H6c-1.1 0-2 .9-2 2v2c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2v1c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-1c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zM9 16H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zM6 11V7h12v4H6z"/></svg>`;
  const ICON_APPLY = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>`;

  /* ── 유틸 ────────────────────────────────────────────────── */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * 마크다운 기본 렌더링 (bold, 줄바꿈, 번호/글머리 목록)
   */
  function renderMarkdown(text) {
    let html = escapeHtml(text);
    // **bold**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // 줄바꿈
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function timeNow() {
    const d = new Date();
    return d.getHours().toString().padStart(2, '0') + ':' +
           d.getMinutes().toString().padStart(2, '0');
  }

  /* ── 위젯 클래스 ─────────────────────────────────────────── */
  class XinchaoWidget {
    constructor() {
      this.messages = []; // { role, content }
      this.isOpen = false;
      this.isLoading = false;
      this.suggestionsEl = null;
      this._buildDOM();
      this._bindEvents();
      this._showGreeting();
    }

    /* DOM 구성 */
    _buildDOM() {
      // 호스트 엘리먼트
      this.host = document.createElement('div');
      this.host.id = 'xinchao-chatbot-host';

      // Shadow DOM 생성
      this.shadow = this.host.attachShadow({ mode: 'closed' });

      // 스타일
      const style = document.createElement('style');
      style.textContent = CSS;
      this.shadow.appendChild(style);

      /* FAB 버튼 래퍼 */
      this.fabWrapper = document.createElement('div');
      this.fabWrapper.id = 'xv-fab-wrapper';

      /* FAB 버튼 */
      this.fab = document.createElement('button');
      this.fab.id = 'xv-fab';
      this.fab.setAttribute('aria-label', '씬짜오베트남 광고 안내 챗봇 열기');
      this.fab.innerHTML = ICON_CHAT;

      this.badge = document.createElement('div');
      this.badge.id = 'xv-badge';
      this.fab.appendChild(this.badge);

      /* FAB 라벨 */
      this.fabLabel = document.createElement('div');
      this.fabLabel.id = 'xv-fab-label';
      this.fabLabel.textContent = '씬짜오 광고 컨설팅';

      this.fabWrapper.appendChild(this.fabLabel);
      this.fabWrapper.appendChild(this.fab);

      /* 채팅창 */
      this.win = document.createElement('div');
      this.win.id = 'xv-window';
      this.win.classList.add('xv-hidden');
      this.win.setAttribute('role', 'dialog');
      this.win.setAttribute('aria-label', '씬짜오베트남 광고 안내 챗봇');

      // 헤더
      this.win.innerHTML = `
        <div id="xv-header">
          <div id="xv-header-avatar">${ICON_BOT}</div>
          <div id="xv-header-info">
            <div id="xv-header-title">씬짜오베트남 광고 안내</div>
            <div id="xv-header-sub">AI 광고 컨설턴트</div>
          </div>
          <button id="xv-close" aria-label="닫기">${ICON_CLOSE}</button>
        </div>
        <div id="xv-messages" role="log" aria-live="polite"></div>
        <div id="xv-input-area">
          <textarea id="xv-input" placeholder="궁금한 점을 입력하세요..." rows="1" aria-label="메시지 입력"></textarea>
          <button id="xv-send" aria-label="전송">${ICON_SEND}</button>
        </div>
      `;

      this.shadow.appendChild(this.win);
      this.shadow.appendChild(this.fabWrapper);

      // 자주 참조하는 요소
      this.messagesEl = this.shadow.getElementById('xv-messages');
      this.inputEl = this.shadow.getElementById('xv-input');
      this.sendBtn = this.shadow.getElementById('xv-send');
      this.closeBtn = this.shadow.getElementById('xv-close');

      document.body.appendChild(this.host);
    }

    /* 이벤트 바인딩 */
    _bindEvents() {
      this.fab.addEventListener('click', () => this.toggle());
      this.closeBtn.addEventListener('click', () => this.close());

      this.sendBtn.addEventListener('click', () => this._handleSend());

      this.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._handleSend();
        }
      });

      // 텍스트에어리어 자동 높이 조절
      this.inputEl.addEventListener('input', () => {
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 110) + 'px';
      });
    }

    /* 채팅창 열기/닫기 */
    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      this.isOpen = true;
      this.host.classList.add('xv-is-open');
      this.win.classList.remove('xv-hidden');
      this.badge.classList.remove('show');
      this.fabLabel.classList.add('xv-label-hidden');
      this.fab.setAttribute('aria-label', '씬짜오베트남 광고 안내 챗봇 닫기');
      setTimeout(() => this.inputEl.focus(), 250);
      this._scrollToBottom();
    }

    close() {
      this.isOpen = false;
      this.host.classList.remove('xv-is-open');
      this.win.classList.add('xv-hidden');
      this.fabLabel.classList.remove('xv-label-hidden');
      this.fab.setAttribute('aria-label', '씬짜오베트남 광고 안내 챗봇 열기');
    }

    /* 인사 메시지 */
    _showGreeting() {
      this._appendBotMessage(GREETING, null, true);
      // 처음엔 닫혀있으므로 뱃지 표시
      this.badge.classList.add('show');
    }

    /* 추천 질문 클릭 전송 */
    _sendSuggestion(text) {
      // 추천 질문 영역 즉시 제거
      if (this.suggestionsEl) {
        this.suggestionsEl.remove();
        this.suggestionsEl = null;
      }
      // 입력창에 텍스트 세팅 후 전송
      this.inputEl.value = text;
      this._handleSend();
    }

    /* 메시지 전송 처리 */
    async _handleSend() {
      const text = this.inputEl.value.trim();
      if (!text || this.isLoading) return;

      // 추천 질문 영역 제거 (직접 입력 시에도)
      if (this.suggestionsEl) {
        this.suggestionsEl.remove();
        this.suggestionsEl = null;
      }

      // 사용자 메시지 추가
      this._appendUserMessage(text);
      this.messages.push({ role: 'user', content: text });

      // 입력창 초기화
      this.inputEl.value = '';
      this.inputEl.style.height = 'auto';

      // 로딩 시작
      this._setLoading(true);
      const typingEl = this._appendTypingIndicator();

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: this.messages }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `서버 오류 (${res.status})`);
        }

        // 타이핑 인디케이터 제거
        typingEl.remove();

        // 스트리밍 읽기 준비
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        // 봇 응답용 빈 버블 생성
        const row = document.createElement('div');
        row.className = 'xv-msg-row xv-bot';
        row.innerHTML = `
          <div class="xv-bot-avatar">${ICON_BOT}</div>
          <div>
            <div class="xv-bubble"></div>
            <div class="xv-rec-container"></div>
          </div>
          <span class="xv-time">${timeNow()}</span>
        `;
        this.messagesEl.appendChild(row);
        const bubble = row.querySelector('.xv-bubble');
        const recContainer = row.querySelector('.xv-rec-container');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;

          // 추천 JSON 마커 확인
          const marker = "RECOMMENDATION_JSON:";
          const markerIdx = fullContent.indexOf(marker);

          let displayContent = fullContent;
          if (markerIdx !== -1) {
            displayContent = fullContent.slice(0, markerIdx).trim();
          }

          bubble.innerHTML = renderMarkdown(displayContent);
          this._scrollToBottom();
        }

        // 최종 파싱 및 추천 카드 처리
        const marker = "RECOMMENDATION_JSON:";
        const markerIdx = fullContent.indexOf(marker);
        let finalReply = fullContent;
        let recommendation = null;

        if (markerIdx !== -1) {
          finalReply = fullContent.slice(0, markerIdx).trim();
          const jsonStr = fullContent.slice(markerIdx + marker.length).trim();
          try {
            recommendation = JSON.parse(jsonStr);
          } catch (e) {
            console.error('Recommendation JSON parse error:', e);
          }
        }

        if (recommendation) {
          // 추천 카드 렌더링 (기존 _appendBotMessage의 로직 참고)
          const pkg = escapeHtml(recommendation.packageName || '');
          const months = parseInt(recommendation.months, 10) || 1;
          const addons = Array.isArray(recommendation.addons) ? recommendation.addons : [];
          const addonsStr = addons.map(a => escapeHtml(a)).join(', ');
          const params = new URLSearchParams({
            pkg: recommendation.packageName || '',
            months: String(months),
          });
          if (addons.length > 0) {
            params.set('addons', addons.join(','));
          }
          const applyUrl = '/ads_request?' + params.toString();
          const detailText = months > 1
            ? `${months}개월 계약${addons.length > 0 ? ' · ' + addonsStr : ''}`
            : addons.length > 0 ? addonsStr : '';

          const quoteAddons = addons;
          const quoteMonths = months;
          const quotePkg = recommendation.packageName || '';
          recContainer.innerHTML = `
            <div class="xv-rec-card">
              <div class="xv-rec-label">추천 패키지</div>
              <div class="xv-rec-pkg">${pkg}</div>
              ${detailText ? `<div class="xv-rec-detail">${detailText}</div>` : ''}
              <button class="xv-rec-btn" onclick="window.location.href='${applyUrl}'">
                ${ICON_APPLY}
                광고 신청하기
              </button>
              <button class="xv-rec-btn xv-rec-btn-quote" id="xv-quote-btn-stream">
                📄 견적서 받기
              </button>
            </div>
          `;
          recContainer.querySelector('#xv-quote-btn-stream').addEventListener('click', () => {
            this._generateQuote(quotePkg, quoteMonths, quoteAddons);
          });
          this._scrollToBottom();
        }

        this.messages.push({ role: 'assistant', content: finalReply });

      } catch (err) {
        if (typingEl && typingEl.parentNode) typingEl.remove();
        this._appendErrorMessage(err.message || '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        this._setLoading(false);
      }
    }

    /* 로딩 상태 */
    _setLoading(val) {
      this.isLoading = val;
      this.sendBtn.disabled = val;
      this.inputEl.disabled = val;
    }

    /* 메시지 추가 헬퍼들 */
    _appendUserMessage(text) {
      const row = document.createElement('div');
      row.className = 'xv-msg-row xv-user';
      row.innerHTML = `
        <span class="xv-time">${timeNow()}</span>
        <div class="xv-bubble">${renderMarkdown(text)}</div>
      `;
      this.messagesEl.appendChild(row);
      this._scrollToBottom();
    }

    _appendBotMessage(text, recommendation, showSuggestions) {
      const row = document.createElement('div');
      row.className = 'xv-msg-row xv-bot';

      let recHtml = '';
      if (recommendation) {
        const pkg = escapeHtml(recommendation.packageName || '');
        const months = parseInt(recommendation.months, 10) || 1;
        const addons = Array.isArray(recommendation.addons) ? recommendation.addons : [];
        const addonsStr = addons.map(a => escapeHtml(a)).join(', ');
        const params = new URLSearchParams({
          pkg: recommendation.packageName || '',
          months: String(months),
        });
        if (addons.length > 0) {
          params.set('addons', addons.join(','));
        }
        const applyUrl = '/ads_request?' + params.toString();
        const detailText = months > 1
          ? `${months}개월 계약${addons.length > 0 ? ' · ' + addonsStr : ''}`
          : addons.length > 0 ? addonsStr : '';

        const _quotePkg = recommendation.packageName || '';
        const _quoteMonths = months;
        const _quoteAddons = addons;
        recHtml = `
          <div class="xv-rec-card">
            <div class="xv-rec-label">추천 패키지</div>
            <div class="xv-rec-pkg">${pkg}</div>
            ${detailText ? `<div class="xv-rec-detail">${detailText}</div>` : ''}
            <button class="xv-rec-btn" onclick="window.location.href='${applyUrl}'">
              ${ICON_APPLY}
              광고 신청하기
            </button>
            <button class="xv-rec-btn xv-rec-btn-quote" data-pkg="${escapeHtml(_quotePkg)}" data-months="${_quoteMonths}" data-addons="${escapeHtml(_quoteAddons.join('||'))}">
              📄 견적서 받기
            </button>
          </div>
        `;
      }

      row.innerHTML = `
        <div class="xv-bot-avatar">${ICON_BOT}</div>
        <div>
          <div class="xv-bubble">${renderMarkdown(text)}</div>
          ${recHtml}
        </div>
        <span class="xv-time">${timeNow()}</span>
      `;
      this.messagesEl.appendChild(row);

      const quoteBtn = row.querySelector('.xv-rec-btn-quote');
      if (quoteBtn) {
        quoteBtn.addEventListener('click', () => {
          const p = quoteBtn.dataset.pkg;
          const m = parseInt(quoteBtn.dataset.months, 10) || 1;
          const a = quoteBtn.dataset.addons ? quoteBtn.dataset.addons.split('||').filter(Boolean) : [];
          this._generateQuote(p, m, a);
        });
      }

      // 추천 질문 버튼 (첫 인사말에만)
      if (showSuggestions) {
        const suggestions = [
          '광고 패키지 종류가 궁금해요',
          '우리 업종에 맞는 광고는?',
          '광고 비용이 얼마인가요?',
          '온라인 광고만 할 수 있나요?',
        ];
        this.suggestionsEl = document.createElement('div');
        this.suggestionsEl.id = 'xv-suggestions';
        suggestions.forEach(q => {
          const btn = document.createElement('button');
          btn.className = 'xv-sug-btn';
          btn.textContent = q;
          btn.addEventListener('click', () => {
            this._sendSuggestion(q);
          });
          this.suggestionsEl.appendChild(btn);
        });
        this.messagesEl.appendChild(this.suggestionsEl);
      }

      this._scrollToBottom();

      // 창이 닫혀있으면 뱃지
      if (!this.isOpen) {
        this.badge.classList.add('show');
      }
    }

    _appendTypingIndicator() {
      const row = document.createElement('div');
      row.className = 'xv-msg-row xv-bot';
      row.innerHTML = `
        <div class="xv-bot-avatar">${ICON_BOT}</div>
        <div class="xv-bubble xv-typing">
          <span></span><span></span><span></span>
        </div>
      `;
      this.messagesEl.appendChild(row);
      this._scrollToBottom();
      return row;
    }

    _appendErrorMessage(msg) {
      const div = document.createElement('div');
      div.className = 'xv-error';
      div.textContent = msg;
      this.messagesEl.appendChild(div);
      this._scrollToBottom();
    }

    _scrollToBottom() {
      requestAnimationFrame(() => {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      });
    }

    _generateQuote(packageName, months, addons) {
      const PRICES = {
        '디지털 스타터': 250,
        '디지털 프리미엄': 350,
        '디지털 베스트': 500,
        '통합 패키지 A': 1050,
        '통합 패키지 B': 1150,
        '통합 패키지 C': 1250,
        '프리미엄 올인원': 3000,
      };
      const DISCOUNTS = { 3: 5, 6: 10, 12: 15 };

      const basePrice = PRICES[packageName] || 0;
      const discountRate = DISCOUNTS[months] || 0;
      const addonTotal = addons.reduce((sum, a) => {
        const m = a.match(/\$([0-9,]+)/);
        return sum + (m ? parseInt(m[1].replace(',', ''), 10) : 0);
      }, 0);
      const subtotal = (basePrice + addonTotal) * months;
      const discountAmt = Math.round(subtotal * discountRate / 100);
      const total = subtotal - discountAmt;

      const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
      const addonsHtml = addons.length > 0
        ? addons.map(a => {
            const m = a.match(/\$([0-9,]+)/);
            const p = m ? parseInt(m[1].replace(',', ''), 10) : 0;
            return `<tr><td>${a}</td><td class="num">$${p.toLocaleString()}/월</td><td class="num">$${(p * months).toLocaleString()}</td></tr>`;
          }).join('')
        : '';

      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>씬짜오베트남 광고 견적서</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #222; background: #fff; padding: 40px; max-width: 700px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #d32f2f; padding-bottom: 16px; margin-bottom: 28px; }
  .brand { font-size: 22px; font-weight: 700; color: #d32f2f; }
  .brand-sub { font-size: 12px; color: #666; margin-top: 4px; }
  .doc-info { text-align: right; font-size: 13px; color: #555; line-height: 1.8; }
  h2 { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 28px; letter-spacing: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
  th { background: #f5f5f5; padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .highlight { background: #fff8f8; font-weight: 600; }
  .total-row td { border-top: 2px solid #d32f2f; font-size: 16px; font-weight: 700; color: #d32f2f; padding: 12px; }
  .discount-row td { color: #e53935; }
  .notice { margin-top: 32px; padding: 14px 16px; background: #fff3e0; border-left: 4px solid #ff9800; border-radius: 4px; font-size: 13px; color: #555; line-height: 1.7; }
  .notice strong { color: #e65100; display: block; margin-bottom: 4px; font-size: 14px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center; line-height: 2; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
    @page { margin: 15mm; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">씬짜오베트남 (Xin Chao Vietnam)</div>
    <div class="brand-sub">베트남 한인사회 대표 교민 미디어 · 창간 2002</div>
  </div>
  <div class="doc-info">
    <div><strong>광고 견적서</strong></div>
    <div>발행일: ${today}</div>
    <div>담당: info@chaovietnam.co.kr</div>
    <div>전화: 079-283-2000</div>
  </div>
</div>

<h2>광 고 견 적 서</h2>

<table>
  <thead>
    <tr><th>항목</th><th>단가 (월)</th><th>금액 (${months}개월)</th></tr>
  </thead>
  <tbody>
    <tr class="highlight">
      <td>${packageName}</td>
      <td class="num">$${basePrice.toLocaleString()}/월</td>
      <td class="num">$${(basePrice * months).toLocaleString()}</td>
    </tr>
    ${addonsHtml}
    <tr>
      <td colspan="2" style="text-align:right; color:#555;">소계 (${months}개월)</td>
      <td class="num">$${subtotal.toLocaleString()}</td>
    </tr>
    ${discountRate > 0 ? `
    <tr class="discount-row">
      <td colspan="2" style="text-align:right;">장기 계약 할인 (${months}개월 · ${discountRate}%)</td>
      <td class="num">-$${discountAmt.toLocaleString()}</td>
    </tr>` : ''}
    <tr class="total-row">
      <td colspan="2" style="text-align:right;">최종 합계</td>
      <td class="num">$${total.toLocaleString()}</td>
    </tr>
  </tbody>
</table>

<div class="notice">
  <strong>⚠ 참고용 견적 안내</strong>
  이 견적서는 1차 참고용 견적서입니다. 정식 견적서는 영업부의 검토를 거쳐 재발행됩니다.<br>
  실제 계약 금액은 광고 소재 구성, 게재 일정, 협의 조건에 따라 달라질 수 있습니다.
</div>

<div class="footer">
  chaovietnam.co.kr · info@chaovietnam.co.kr · Tel. 079-283-2000<br>
  가격은 USD 기준이며, 실제 결제는 베트남 동(VND) 환산 지불 / 세금계산서 발행 가능
</div>

<div class="no-print" style="text-align:center; margin-top: 32px;">
  <button onclick="window.print()" style="padding:10px 28px; background:#d32f2f; color:#fff; border:none; border-radius:6px; font-size:15px; cursor:pointer; font-family:inherit;">🖨 인쇄 / PDF 저장</button>
</div>
</body>
</html>`;

      const w = window.open('', '_blank', 'width=750,height=900');
      w.document.write(html);
      w.document.close();
    }
  }

  /* ── 초기화 ──────────────────────────────────────────────── */
  function init() {
    if (document.getElementById('xinchao-chatbot-host')) return; // 중복 방지
    new XinchaoWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
