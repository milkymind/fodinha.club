import { render, screen } from '@testing-library/react'
import Game from '../src/components/Game/index'
import { SocketContext } from '../contexts/SocketContext'

// Mock socket for testing
const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
}

// Mock props for the Game component
const mockProps = {
  gameId: 'test-game-123',
  playerId: 1,
  onLeaveGame: jest.fn(),
}

describe('Game Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
  })

  it('renders game room header', () => {
    render(
      <SocketContext.Provider value={mockSocket}>
        <Game {...mockProps} />
      </SocketContext.Provider>
    )

    // Check if the game room header is displayed
    expect(screen.getByText(/Game Room: test-game-123/i)).toBeInTheDocument()
  })

  it('renders leave game button', () => {
    render(
      <SocketContext.Provider value={mockSocket}>
        <Game {...mockProps} />
      </SocketContext.Provider>
    )

    // Check if the leave game button is present
    const leaveButton = screen.getByRole('button', { name: /leave game/i })
    expect(leaveButton).toBeInTheDocument()
  })

  it('renders players section', () => {
    render(
      <SocketContext.Provider value={mockSocket}>
        <Game {...mockProps} />
      </SocketContext.Provider>
    )

    // Check if the players section is displayed
    expect(screen.getByText(/Players/i)).toBeInTheDocument()
  })
}) 