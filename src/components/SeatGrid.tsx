import { useState } from 'react';
import { Crown, UserRound } from 'lucide-react';
import type { PublicSeat } from '../types/protocol';

interface SeatGridProps {
  seats: PublicSeat[];
  mode: 'host' | 'player';
  myPeerId?: string | null;
  onSelectSeat?: (seatNumber: number) => void;
  onSwapSeats?: (seatA: number, seatB: number) => void;
}

export function SeatGrid({ seats, mode, myPeerId, onSelectSeat, onSwapSeats }: SeatGridProps) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const handleHostClick = (seatNumber: number) => {
    if (selectedSeat === null) {
      setSelectedSeat(seatNumber);
    } else if (selectedSeat === seatNumber) {
      setSelectedSeat(null);
    } else {
      onSwapSeats?.(selectedSeat, seatNumber);
      setSelectedSeat(null);
    }
  };

  return (
    <div className="seat-grid-wrap">
      <div className={`seat-grid ${seats.length > 9 ? 'seat-grid--dense' : ''}`}>
        {seats.map((seat) => {
          const occupied = seat.peerId !== null;
          const mine = mode === 'player' && seat.peerId === myPeerId;
          const selected = selectedSeat === seat.seatNumber;
          return (
            <button
              type="button"
              key={seat.seatNumber}
              className={`seat-card ${occupied ? 'seat-card--occupied' : ''} ${mine ? 'seat-card--mine' : ''} ${selected ? 'seat-card--selected' : ''}`}
              onClick={() => mode === 'host' ? handleHostClick(seat.seatNumber) : onSelectSeat?.(seat.seatNumber)}
              disabled={mode === 'player' && occupied && !mine}
              draggable={mode === 'host'}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', String(seat.seatNumber));
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (mode === 'host') event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const source = Number(event.dataTransfer.getData('text/plain'));
                if (source) onSwapSeats?.(source, seat.seatNumber);
                setSelectedSeat(null);
              }}
            >
              <span className="seat-card__top">
                <span className="seat-number">{String(seat.seatNumber).padStart(2, '0')}</span>
                {seat.isHost && <Crown size={15} aria-label="房主" />}
              </span>
              <span className="seat-card__avatar">
                <UserRound size={22} strokeWidth={1.6} />
              </span>
              <span className="seat-card__name">{occupied ? seat.playerName : '等待入座'}</span>
              <span className="seat-card__state">
                {mine ? '我的座位' : occupied ? '已入座' : mode === 'player' ? '点击选择' : '空座位'}
              </span>
            </button>
          );
        })}
      </div>
      <p className="seat-grid-hint">
        {mode === 'host' ? '点选两个座位即可交换，也可以直接拖拽调位' : '选择一个空位坐下；发牌后座位将锁定'}
      </p>
    </div>
  );
}
