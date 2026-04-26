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

  const GREETING = '안녕하세요! 씬짜오베트남 광고에 대해 궁금한 점을 물어보세요. 예산, 목적, 타깃에 맞는 최적의 광고 패키지를 추천해 드릴게요.';

  /* ── CSS ────────────────────────────────────────────────── */
  const CSS = `
    :host {
      all: initial;
      font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
    }

    /* 플로팅 버튼 */
    #xv-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483640;
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

    /* 입력 영역 */
    #xv-input-area {
      padding: 10px 12px 12px;
      background: #fff;
      border-top: 1px solid #f0f0f0;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }
    #xv-input {
      flex: 1;
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

    /* 모바일 반응형 */
    @media (max-width: 480px) {
      #xv-window {
        bottom: 0 !important;
        right: 0 !important;
        width: 100vw !important;
        height: 100dvh !important;
        border-radius: 0 !important;
      }
      #xv-window.xv-hidden {
        transform: translateY(100%) !important;
      }
      #xv-fab {
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

      /* FAB 버튼 */
      this.fab = document.createElement('button');
      this.fab.id = 'xv-fab';
      this.fab.setAttribute('aria-label', '씬짜오베트남 광고 안내 챗봇 열기');
      this.fab.innerHTML = ICON_CHAT;

      this.badge = document.createElement('div');
      this.badge.id = 'xv-badge';
      this.fab.appendChild(this.badge);

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
      this.shadow.appendChild(this.fab);

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
      this.win.classList.remove('xv-hidden');
      this.badge.classList.remove('show');
      this.fab.setAttribute('aria-label', '씬짜오베트남 광고 안내 챗봇 닫기');
      setTimeout(() => this.inputEl.focus(), 250);
      this._scrollToBottom();
    }

    close() {
      this.isOpen = false;
      this.win.classList.add('xv-hidden');
      this.fab.setAttribute('aria-label', '씬짜오베트남 광고 안내 챗봇 열기');
    }

    /* 인사 메시지 */
    _showGreeting() {
      this._appendBotMessage(GREETING);
      // 처음엔 닫혀있으므로 뱃지 표시
      this.badge.classList.add('show');
    }

    /* 메시지 전송 처리 */
    async _handleSend() {
      const text = this.inputEl.value.trim();
      if (!text || this.isLoading) return;

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

        const data = await res.json();
        const reply = data.reply || '응답을 받지 못했습니다.';
        const recommendation = data.recommendation || null;

        // 타이핑 인디케이터 제거
        typingEl.remove();

        // 봇 응답 추가
        this._appendBotMessage(reply, recommendation);
        this.messages.push({ role: 'assistant', content: reply });

      } catch (err) {
        typingEl.remove();
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

    _appendBotMessage(text, recommendation) {
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

        recHtml = `
          <div class="xv-rec-card">
            <div class="xv-rec-label">추천 패키지</div>
            <div class="xv-rec-pkg">${pkg}</div>
            ${detailText ? `<div class="xv-rec-detail">${detailText}</div>` : ''}
            <button class="xv-rec-btn" onclick="window.location.href='${applyUrl}'">
              ${ICON_APPLY}
              광고 신청하기
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
