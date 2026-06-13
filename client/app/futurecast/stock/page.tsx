'use client';

/**
 * Stock Up / Stock Down board — /futurecast/stock
 */
import React, { useEffect, useState } from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { FutureCastHomeCard } from '@/components/futurecast/FutureCastHomeCard';
import { fetchStockBoard, type FeedPrediction } from '@/lib/predictions-api';
import '@/lib/futurecast.css';

const REFRESH_MS = 60_000;

export default function StockBoardPage(): React.ReactElement {
  const [stockUp, setStockUp] = useState<FeedPrediction[]>([]);
  const [stockDown, setStockDown] = useState<FeedPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load(isInitial: boolean) {
      if (isInitial) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await fetchStockBoard();
        if (!cancelled) {
          setStockUp(data.stockUp);
          setStockDown(data.stockDown);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error loading Stock Up / Stock Down.');
        }
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    }

    void load(true);
    timer = setInterval(() => void load(false), REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="fc-stock-board-wrap">
        <p className="fc-stock-board__status">Loading Stock Up / Stock Down…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fc-stock-board-wrap">
        <p className="fc-stock-board__error">{error}</p>
      </div>
    );
  }

  return (
    <div className="fc-stock-board-wrap" data-testid="stock-board-page">
      <FutureCastSubNav active="stock" />
      <h1 className="fc-stock-board__title">Stock Up / Stock Down</h1>
      <p className="fc-stock-board__subtitle">7-day MODEL confidence movers</p>
      <div className="fc-stock-board">
        <section className="fc-stock-board__column">
          <h2 className="fc-stock-board__heading fc-stock-board__heading--up">Stock Up</h2>
          <div className="fc-home-card-grid">
            {stockUp.map((prediction) => (
              <FutureCastHomeCard
                key={prediction.id}
                prediction={prediction}
                variant="trending-up"
              />
            ))}
            {stockUp.length === 0 && (
              <p className="fc-stock-board__empty">No risers in the current window.</p>
            )}
          </div>
        </section>
        <section className="fc-stock-board__column">
          <h2 className="fc-stock-board__heading fc-stock-board__heading--down">Stock Down</h2>
          <div className="fc-home-card-grid">
            {stockDown.map((prediction) => (
              <FutureCastHomeCard
                key={prediction.id}
                prediction={prediction}
                variant="trending-down"
              />
            ))}
            {stockDown.length === 0 && (
              <p className="fc-stock-board__empty">No fallers in the current window.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
