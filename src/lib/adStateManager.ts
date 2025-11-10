"use client";

// Définition des types pour la clarté et la sécurité
type AdFormat = 'popunder' | 'in_page_push' | 'push_prompt';
type UserStatus = 'newcomer' | 'engaged' | 'habituated' | 'premium';

// Configuration des règles de capping (en heures)
const CAPPING_RULES: Record<AdFormat, number> = {
  popunder: 24,       // 1 Pop-under toutes les 24 heures
  in_page_push: 2,    // 1 In-Page Push toutes les 2 heures
  push_prompt: 24,    // 1 Soft Prompt toutes les 24 heures si refusé
};

// Configuration des seuils pour le statut utilisateur
const USER_STATUS_THRESHOLDS = {
  engaged_visits: 2,
  habituated_visits: 6,
};

class AdStateManager {
  private visitCount: number = 0;
  private pageViews: number = 0;

  constructor() {
    this.init();
  }

  /**
   * Initialise le suivi de l'utilisateur (visites, pages vues)
   */
  private init() {
    // Suivi des visites
    let visitTimestamp = sessionStorage.getItem('visit_timestamp');
    if (!visitTimestamp) {
      sessionStorage.setItem('visit_timestamp', Date.now().toString());
      const currentVisitCount = parseInt(localStorage.getItem('visit_count') || '0', 10);
      this.visitCount = currentVisitCount + 1;
      localStorage.setItem('visit_count', this.visitCount.toString());
    } else {
      this.visitCount = parseInt(localStorage.getItem('visit_count') || '1', 10);
    }

    // Suivi des pages vues par session
    this.pageViews = parseInt(sessionStorage.getItem('page_views') || '0', 10) + 1;
    sessionStorage.setItem('page_views', this.pageViews.toString());
  }

  /**
   * Détermine le statut de l'utilisateur basé sur son historique
   */
  public getUserStatus(): UserStatus {
    if (this.isPremium()) {
      return 'premium';
    }
    if (this.visitCount >= USER_STATUS_THRESHOLDS.habituated_visits) {
      return 'habituated';
    }
    if (this.visitCount >= USER_STATUS_THRESHOLDS.engaged_visits) {
      return 'engaged';
    }
    return 'newcomer';
  }

  /**
   * Vérifie si un format publicitaire peut être affiché, en fonction du capping et du statut utilisateur
   */
  public canShow(format: AdFormat): boolean {
    if (this.isPremium()) {
      return false; // Jamais de pub pour les Premium
    }

    const userStatus = this.getUserStatus();

    // Logique adaptative
    switch (format) {
      case 'popunder':
        if (userStatus === 'newcomer') return false; // Pas de Pop-under pour les nouveaux
        break;
      // D'autres règles pourraient être ajoutées ici
    }

    // Logique de Capping (fréquence)
    const lastShown = localStorage.getItem(`monetag_${format}_timestamp`);
    if (!lastShown) return true;

    const hoursElapsed = (Date.now() - parseInt(lastShown, 10)) / 3600000;
    return hoursElapsed > CAPPING_RULES[format];
  }

  /**
   * Marque un format publicitaire comme ayant été affiché
   */
  public markAsShown(format: AdFormat) {
    localStorage.setItem(`monetag_${format}_timestamp`, Date.now().toString());
  }

  /**
   * Vérifie si l'utilisateur a déjà accepté les notifications push
   */
  public hasAcceptedPush(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  /**
   * Vérifie si l'utilisateur est un abonné Premium (logique à adapter)
   */
  public isPremium(): boolean {
    // Logique de vérification Premium (ex: cookie, localStorage, appel API)
    return localStorage.getItem('user_premium') === 'true';
  }
}

// Exporter une instance unique (Singleton) pour toute l'application
export const adStateManager = new AdStateManager();