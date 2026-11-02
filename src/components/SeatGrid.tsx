import { useState } from 'react';
import type { PublicSeat } from '../types/protocol';

interface SeatGridProps {
  seats: PublicSeat[];
  mode: 'god' | 'player';
  myPeerId?: string | null;
  onSelectSeat?: (seatNumber: number) => void;
  onSwapSeats?: (seatA: number, seatB: number) => void;
}

export function SeatGrid({ seats, mode, myPeerId, onSelectSeat, onSwapSeats }: SeatGridProps) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const handleGodClick = (seatNumber: number) => {
    if (selectedSeat === null) setSelectedSeat(seatNumber);
    else if (selectedSeat === seatNumber) setSelectedSeat(null);
    else {
      onSwapSeats?.(selectedSeat, seatNumber);
      setSelectedSeat(null);
    }
  };

  return (
    <div className="compact-seat-grid">
      {seats.map((seat) => {
        const occupied = seat.peerId !== null;
        const mine = mode === 'player' && seat.peerId === myPeerId;
        const selected = selectedSeat === seat.seatNumber;
        return (
          <button
            type="button"
            key={seat.seatNumber}
            className={`compact-seat ${occupied ? 'compact-seat--occupied' : ''} ${mine ? 'compact-seat--mine' : ''} ${selected ? 'compact-seat--selected' : ''}`}
            onClick={() => mode === 'god' ? handleGodClick(seat.seatNumber) : onSelectSeat?.(seat.seatNumber)}
            disabled={mode === 'player' && occupied && !mine}
            draggable={mode === 'god'}
            onDragStart={(event) => event.dataTransfer.setData('text/plain', String(seat.seatNumber))}
            onDragOver={(event) => { if (mode === 'god') event.preventDefault(); }}
            onDrop={(event) => {
              event.preventDefault();
              const source = Number(event.dataTransfer.getData('text/plain'));
              if (source) onSwapSeats?.(source, seat.seatNumber);
              setSelectedSeat(null);
            }}
          >
            <span className="compact-seat__number">{String(seat.seatNumber).padStart(2, '0')}</span>
            <strong>{occupied ? seat.playerName : '空位'}</strong>
            <small>{mine ? '我的座位' : occupied ? '已入座' : mode === 'player' ? '点击入座' : '等待玩家'}</small>
          </button>
        );
      })}
    </div>
  );
}
