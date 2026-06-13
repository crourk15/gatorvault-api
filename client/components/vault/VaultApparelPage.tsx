'use client';

import React from 'react';
import { APPAREL_PILLS, APPAREL_SHOPS } from '@/lib/vault-catalog';

export function VaultApparelPage(): React.ReactElement {
  return (
    <div className="gv-vault-apparel" data-testid="vault-apparel">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">👕 Apparel & Gameday Gear</h1>
        <p className="gv-page-subtitle">
          Curated picks and trusted storefronts for every Gator fan — from jerseys to tailgate
          essentials.
        </p>
        <div className="gv-apparel-pills">
          {APPAREL_PILLS.map((pill) => (
            <span key={pill} className="gv-apparel-pill">
              {pill}
            </span>
          ))}
        </div>
      </div>

      <div className="gv-apparel-grid">
        {APPAREL_SHOPS.map((shop) => (
          <article key={shop.name} className="gv-apparel-card">
            <div className="gv-apparel-card__top">
              <span className="gv-apparel-card__icon" aria-hidden="true">
                {shop.icon}
              </span>
              <span className="gv-apparel-card__badge">{shop.badge}</span>
            </div>
            <h2 className="gv-apparel-card__name">{shop.name}</h2>
            <p className="gv-apparel-card__desc">{shop.desc}</p>
            <a
              href={shop.url}
              target="_blank"
              rel="noopener noreferrer"
              className="gv-apparel-btn"
            >
              Shop Now →
            </a>
          </article>
        ))}
      </div>

      <div className="gv-vault-tickets__tips">
        <div className="gv-vault-tip">
          <p className="gv-vault-tip__label">🐊 GatorVault Tip</p>
          <p className="gv-vault-tip__text">
            For authentic game-day jerseys, start with the Gator Sportshop (shop.floridagators.com)
            or Fanatics. Both are officially licensed.
          </p>
        </div>
        <div className="gv-vault-tip">
          <p className="gv-vault-tip__label">🎁 Gift Idea</p>
          <p className="gv-vault-tip__text">
            Campus-exclusive designs live at the UF Bookstore (bkstr.com). For fast shipping,
            Amazon&apos;s Gators search is your best last-minute option.
          </p>
        </div>
      </div>
    </div>
  );
}
