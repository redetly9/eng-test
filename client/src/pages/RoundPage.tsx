import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { RoundResponse, RoundWithResultsResponse } from '../types/api';
import { Goose } from '../components/Goose';
import './RoundPage.css';

const RoundPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const [roundData, setRoundData] = useState<RoundResponse | RoundWithResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTapping, setIsTapping] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [needReloadOnFinish, setNeedReloadOnFinish] = useState(false);
  const [tapError, setTapError] = useState<string | null>(null);

  const currentUserScore = tapCount;

  const fetchRoundData = useCallback(async () => {
    if (!uuid) return;
    try {
      setLoading(true);
      const data = await apiService.getRound(uuid);
      setRoundData(data);
      const initialScore = 'currentUserScore' in data ? data.currentUserScore : 0;
      setTapCount(initialScore);
      setNeedReloadOnFinish(new Date(data.round.end_datetime) > new Date());
    } catch (err) {
      setError('Ошибка загрузки данных раунда');
      console.error('Error fetching round data:', err);
    } finally {
      setLoading(false);
    }
  }, [uuid]);


  // Когда раунд только что завершился (время перешло за end_datetime) — подгружаем результаты с сервера
  useEffect(() => {
    if (!roundData) return;
    const endTime = new Date(roundData.round.end_datetime);
    const now = currentTime.getTime();
    if (now > endTime.getTime() && needReloadOnFinish) {
      setNeedReloadOnFinish(false);
      fetchRoundData();
    }
  }, [currentTime, needReloadOnFinish, roundData, fetchRoundData]);

  // Обновляем текущее время каждую секунду
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Загружаем данные раунда при заходе на страницу
  useEffect(() => {
    fetchRoundData();
  }, [fetchRoundData]);

  // Обработчик тапа
  const handleTap = async () => {
    if (!roundData || isTapping || !uuid) return;
    setTapError(null);
    try {
      setIsTapping(true);
      const response = await apiService.tap(uuid);
      setTapCount(response.score);
    } catch (err) {
      setTapError(err instanceof Error ? err.message : 'Ошибка тапа');
    } finally {
      setTimeout(() => setIsTapping(false), 100);
    }
  };

  // Обработчик зажатия мыши
  const handleMouseDown = () => {
    if (!roundData || isTapping) return;
    setIsTapping(true);
  };

  const handleMouseUp = () => {
    setIsTapping(false);
  };

  // Обработчик отпускания мыши вне элемента
  const handleMouseLeave = () => {
    setIsTapping(false);
  };

  if (loading) {
    return (
      <div className="round-page">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (error || !roundData) {
    return (
      <div className="round-page">
        <div className="error">{error || 'Раунд не найден'}</div>
        <button onClick={() => navigate('/')} className="back-button">
          Вернуться к списку раундов
        </button>
      </div>
    );
  }


  const { round } = roundData;
  const startTime = new Date(round.start_datetime);
  const endTime = new Date(round.end_datetime);
  
  // Определяем состояние раунда
  const isBeforeStart = currentTime < startTime;
  const isActive = currentTime >= startTime && currentTime <= endTime;
  const isFinished = currentTime > endTime;

  // Вычисляем оставшееся время до начала
  const getTimeUntilStart = () => {
    const diff = startTime.getTime() - currentTime.getTime();
    if (diff <= 0) return '00:00:00';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Вычисляем оставшееся время до окончания
  const getTimeUntilEnd = () => {
    const diff = endTime.getTime() - currentTime.getTime();
    if (diff <= 0) return '00:00:00';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const gooseState = isTapping ? 'tapped' : isActive ? 'ready' : 'stop';

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="round-page">
      <div className="round-header">
        <button onClick={() => navigate('/')} className="back-button">
          ← Вернуться к списку раундов
        </button>
        <h1>Раунд {round.uuid.slice(0, 8)}…</h1>
        <span className="round-username">{apiService.decodeToken()?.username ?? ''}</span>
      </div>

      <div className="round-info">
        <div className="round-details">
          <div className="detail-item">
            <span className="label">Начало:</span>
            <span className="value">{formatDateTime(startTime)}</span>
          </div>
          <div className="detail-item">
            <span className="label">Окончание:</span>
            <span className="value">{formatDateTime(endTime)}</span>
          </div>
          <div className="detail-item">
            <span className="label">Статус:</span>
            <span className={`status ${isActive ? 'active' : isFinished ? 'finished' : 'waiting'}`}>
              {isBeforeStart ? 'Cooldown' : isActive ? 'Активен' : 'Раунд завершён'}
            </span>
          </div>
        </div>

        {isBeforeStart && (
          <div className="countdown">
            <h2>Cooldown</h2>
            <div className="countdown-timer">до начала раунда {getTimeUntilStart().slice(3)}</div>
          </div>
        )}

        {isActive && (
          <div className="active-round">
            <h2>Раунд активен!</h2>
            <div className="time-remaining">
              До конца осталось: {getTimeUntilEnd().slice(3)}
            </div>
            {tapError && (
              <div className="tap-error" role="alert">
                {tapError}
              </div>
            )}
          </div>
        )}

        {!isFinished && (
          <div className="score-section">
            <h3>Мои очки — {currentUserScore}</h3>
          </div>
        )}

        {isFinished && 'totalScore' in roundData && roundData.totalScore !== undefined && (
          <div className="round-results">
            <h2>Раунд завершён</h2>
            <div className="results-grid">
              <div className="result-item">
                <span className="result-label">Всего:</span>
                <span className="result-value">{roundData.totalScore}</span>
              </div>
              {roundData.bestPlayer && (
                <div className="result-item">
                  <span className="result-label">Победитель — {roundData.bestPlayer.username}</span>
                  <span className="result-value">{roundData.bestPlayer.score}</span>
                </div>
              )}
              <div className="result-item">
                <span className="result-label">Мои очки:</span>
                <span className="result-value">{roundData.currentUserScore ?? currentUserScore}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="guss-container">
        <Goose
          state={gooseState}
          className={`guss-image ${isActive ? 'clickable' : ''} ${isTapping ? 'tapping' : ''}`}
          onClick={isActive ? handleTap : undefined}
          onMouseDown={isActive ? handleMouseDown : undefined}
          onMouseUp={isActive ? handleMouseUp : undefined}
          onMouseLeave={isActive ? handleMouseLeave : undefined}
        />
        {isActive && (
          <div className="tap-instruction">
            Кликайте на Гуса для набора очков!
          </div>
        )}
      </div>
    </div>
  );
};

export default RoundPage;
