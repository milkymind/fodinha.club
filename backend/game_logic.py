import random
from collections import deque

NAIPES = ['♣', '♥', '♠', '♦']
VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3']
ORDEM_CARTAS = {v: i for i, v in enumerate(VALORES)}
ORDEM_NAIPE_MANILHA = {'♦': 0, '♠': 1, '♥': 2, '♣': 3}
ORDEM_NAIPE_DESEMPATE = {'♣': 3, '♥': 2, '♠': 1, '♦': 0}

class Carta:
    def __init__(self, valor, naipe):
        self.valor, self.naipe = valor, naipe
    def __repr__(self): return f'{self.valor}{self.naipe}'
    def forca(self, manilha=None):
        if manilha and self.valor == manilha:
            return 100 + ORDEM_NAIPE_MANILHA[self.naipe]
        return ORDEM_CARTAS[self.valor]

def criar_baralho():
    baralho = [Carta(v, n) for v in VALORES for n in NAIPES]
    random.shuffle(baralho)
    return deque(baralho)

def definir_manilha(carta_meio):
    return VALORES[(VALORES.index(carta_meio.valor)+1) % len(VALORES)]

def simular_rodada(jogadores, n_cartas, vidas, dealer_idx):
    print("\n🎲 Nova Rodada")
    baralho = criar_baralho()
    carta_meio = baralho.popleft()
    manilha = definir_manilha(carta_meio)
    print(f'Carta do meio: {carta_meio} → Manilha: {manilha}')

    maos = {j:[baralho.popleft() for _ in range(n_cartas)] for j in jogadores}
    dealer = jogadores[dealer_idx]
    print(f"\n🃏 Dealer: Jogador {dealer}")

    idx_primeiro = (dealer_idx + 1) % len(jogadores)
    ordem_palpites = jogadores[idx_primeiro:] + jogadores[:idx_primeiro]

    if n_cartas == 1:
        print("\n🃏 Você NÃO pode ver sua carta.")
        print("🔎 Cartas dos outros jogadores:")
        for j in jogadores[1:]:
            print(f'Jogador {j}: {maos[j][0]}')
    else:
        print("\n🃏 Suas cartas:")
        for i,c in enumerate(maos[1]): print(f'{i+1}: {c}')

    palpites, soma = {}, 0
    print("\n📢 Palpites:")
    for i, j in enumerate(ordem_palpites):
        ultimo = i == len(ordem_palpites)-1
        if j == 1:
            while True:
                try:
                    print(f"Palpites anteriores: {palpites}")
                    p = int(input(f"Jogador {j} (você) — 0-{n_cartas}: "))
                    if 0 <= p <= n_cartas and not (ultimo and soma+p == n_cartas):
                        break
                except ValueError: pass
                print("Palpite inválido ou proibido.")
        else:
            p = random.randint(0, n_cartas)
            if ultimo and soma + p == n_cartas:
                p = (p + 1) % (n_cartas + 1)
        palpites[j], soma = p, soma + p
    for j in jogadores: print(f'Jogador {j}: {palpites[j]}')

    vitorias = {j:0 for j in jogadores}
    ordem_jogada = deque(jogadores[jogadores.index(ordem_palpites[0]):]+jogadores[:jogadores.index(ordem_palpites[0])])
    multiplicador = 1

    for r in range(n_cartas):
        print(f"\n🔁 Jogada {r+1}")
        mesa, canceladas = [], []
        lead_strength, lead_cards = None, []
        for _ in jogadores:
            j_atual = ordem_jogada[0]
            carta = (maos[1].pop(0) if j_atual==1 and n_cartas==1 else
                     (maos[1].pop(int(input("Número da carta: "))-1) if j_atual==1 else maos[j_atual].pop(0)))
            mesa.append((j_atual,carta))
            print(f'Jog {j_atual} jogou {carta}')
            ordem_jogada.rotate(-1)
            st = carta.forca(manilha)
            if lead_strength is None or st > lead_strength:
                lead_strength, lead_cards = st, [(j_atual,carta)]
            elif st == lead_strength:
                canceladas += lead_cards + [(j_atual,carta)]
                lead_strength, lead_cards = None, []
                print("⚠️ Empate: cartas canceladas imediatamente.")
        if lead_cards:
            vencedor = lead_cards[0][0]
            vitorias[vencedor] += multiplicador
            multiplicador = 1
            ordem_jogada = deque(jogadores[jogadores.index(vencedor):]+jogadores[:jogadores.index(vencedor)])
            print(f'✅ Jogador {vencedor} venceu com {lead_cards[0][1]}')
        else:
            rodada_final = r == n_cartas-1
            if rodada_final:
                carta_venc = max(canceladas, key=lambda x: ORDEM_NAIPE_DESEMPATE[x[1].naipe])
                vencedor = carta_venc[0]
                vitorias[vencedor] += multiplicador
                print(f'🏁 Naipe decide: Jog {vencedor} vence com {carta_venc[1]}')
                multiplicador = 1
            else:
                multiplicador += 1
                ultimo = mesa[-1][0]
                ordem_jogada = deque(jogadores[jogadores.index(ultimo):]+jogadores[:jogadores.index(ultimo)])
                print("🔄 Sem vencedor → multiplicador +1")

    print("\n📊 Vitórias finais:")
    for j in jogadores:
        vidas[j] -= abs(vitorias[j]-palpites[j])
        print(f'Jog {j}: {vitorias[j]} vitórias | Palpite {palpites[j]} → vidas = {vidas[j]}')

    mortos = [j for j,v in vidas.items() if v <= 0]
    if mortos:
        print("\n💀 Jogadores eliminados:", ", ".join(map(str,mortos)), ". Fim de jogo.")
        return False
    return True

class FodinhaGame:
    def __init__(self, player_ids, initial_lives=3):
        self.jogadores = player_ids # Use the provided player IDs
        self.vidas = {j: initial_lives for j in self.jogadores}
        self.dealer_idx = random.randint(0, len(self.jogadores) - 1)
        self.cartas = 1
        self.crescendo = True
        # Dynamic max_cartas calculation: 
        # We can use all 40 cards with the workaround, so max_cards = floor(40 / num_players)
        self.max_cartas = max(1, (len(VALORES) * len(NAIPES)) // len(self.jogadores)) if self.jogadores else 1
        self.game_over = False
        print(f"Game initialized with {len(self.jogadores)} players, max {self.max_cartas} cards per player")

    def next_round(self):
        if self.game_over:
            return False
            
        success = simular_rodada(self.jogadores, self.cartas, self.vidas, self.dealer_idx)
        
        if not success:
            self.game_over = True
            return False
            
        # Update game state for next round
        self.cartas += 1 if self.crescendo else -1
        if self.cartas >= self.max_cartas:
            self.crescendo = False
            self.cartas = self.max_cartas - 1
        elif self.cartas <= 1:
            self.crescendo = True
            self.cartas = 2
            
        self.dealer_idx = (self.dealer_idx + 1) % len(self.jogadores)
        return True

    def get_game_state(self):
        return {
            'players': self.jogadores,
            'lives': self.vidas,
            'current_dealer': self.jogadores[self.dealer_idx],
            'cards_per_player': self.cartas,
            'game_over': self.game_over
        }

if __name__ == "__main__":
    # Example usage
    game = FodinhaGame([1, 2, 3, 4])
    while game.next_round():
        print("\nGame state:", game.get_game_state())



