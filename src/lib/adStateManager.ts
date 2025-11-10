"use client";

type AdFormat = 'popunder' | 'in_page_push' | 'push_prompt';
type UserStatus = 'newcomer' | 'engaged' | 'habituated' | 'premium';

const CAPPING_RULES: Record<AdFormat, number> = {
  popunder: 24,
  in_page_push: 2,
  push_prompt: 24,
};

const USER_STATUS_THRESHOLDS = {
  engaged_visits: 2,
  habituated_visits: 6,
};

class AdStateManager {
  private visitCount: number = 0;
  private pageViews: number = 0;
  public adBlockerDetected: boolean = false;
  private sessionHasSeenPreroll: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    let visitTimestamp = sessionStorage.getItem('visit_timestamp');
    if (!visitTimestamp) {
      sessionStorage.setItem('visit_timestamp', Date.now().toString());
      const currentVisitCount = parseInt(localStorage.getItem('visit_count') || '0', 10);
      this.visitCount = currentVisitCount + 1;
      localStorage.setItem('visit_count', this.visitCount.toString());
    } else {
      this.visitCount = parseInt(localStorage.getItem('visit_count') || '1', 10);
    }
    this.pageViews = parseInt(sessionStorage.getItem('page_views') || '0', 10) + 1;
    sessionStorage.setItem('page_views', this.pageViews.toString());
  }

  public getUserStatus(): UserStatus {
    if (this.isPremium()) return 'premium';
    if (this.visitCount >= USER_STATUS_THRESHOLDS.habituated_visits) return 'habituated';
    if (this.visitCount >= USER_STATUS_THRESHOLDS.engaged_visits) return 'engaged';
    return 'newcomer';
  }

  public canShow(format: AdFormat): boolean {
    if (this.isPremium()) return false;
    
    const adFreeUntil = parseInt(localStorage.getItem('adFreeUntil') || '0');
    if (Date.now() < adFreeUntil) return false;

    if (format === 'popunder' && this.sessionHasSeenPreroll) {
      return false;
    }
    const userStatus = this.getUserStatus();
    if (format === 'popunder' && userStatus === 'newcomer') {
      return false;
    }
    const lastShown = localStorage.getItem(`monetag_${format}_timestamp`);
    if (!lastShown) return true;
    const hoursElapsed = (Date.now() - parseInt(lastShown, 10)) / 3600000;
    return hoursElapsed > CAPPING_RULES[format];
  }

  public markAsShown(format: AdFormat) {
    localStorage.setItem(`monetag_${format}_timestamp`, Date.now().toString());
  }

  public markSessionPrerollAsSeen() {
    this.sessionHasSeenPreroll = true;
  }

  public async detectAdBlocker(): Promise<boolean> {
    const bait = document.createElement('div');
    bait.innerHTML = '&nbsp;';
    bait.className = 'adsbox';
    bait.style.position = 'absolute';
    bait.style.left = '-9999px';
    document.body.appendChild(bait);
    await new Promise(resolve => setTimeout(resolve, 100));
    if (bait.offsetHeight === 0) {
      this.adBlockerDetected = true;
    }
    document.body.removeChild(bait);
    return this.adBlockerDetected;
  }

  public grantAdFreePass(durationHours: number) {
    const adFreeUntil = Date.now() + (durationHours * 60 * 60 * 1000);
    localStorage.setItem('adFreeUntil', adFreeUntil.toString());
  }

  public grantAdGatePass(durationHours: number = 12) {
    const passExpiresAt = Date.now() + (durationHours * 60 * 60 * 1000);
    localStorage.setItem('adGatePassExpiresAt', passExpiresAt.toString());
  }

  public hasValidAdGatePass(): boolean {
    const passExpiresAt = parseInt(localStorage.getItem('adGatePassExpiresAt') || '0');
    return Date.now() < passExpiresAt;
  }

  public hasAcceptedPush(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  public isPremium(): boolean {
    return localStorage.getItem('user_premium') === 'true';
  }
}

export const adStateManager = new AdStateManager();