class UIManager {
    static #instance = null;
    #logger;
    #eventManager;
    #elements = new Map();
    #modalContainer;
    #statsDisplay;
    #inventoryPanel;

    constructor() {
        if (UIManager.#instance) {
            return UIManager.#instance;
        }
        this.#logger = new Logger();
        this.#eventManager = new EventManager();
        this.#initialize();
        UIManager.#instance = this;
    }

    static getInstance() {
        if (!UIManager.#instance) {
            UIManager.#instance = new UIManager();
        }
        return UIManager.#instance;
    }

    #initialize() {
        this.#logger.info('Initializing UI Manager...');
        
        // Create main UI container
        const uiContainer = document.createElement('div');
        uiContainer.id = 'uiContainer';
        document.body.appendChild(uiContainer);

        // Create stats display
        this.#statsDisplay = document.createElement('div');
        this.#statsDisplay.id = 'statsDisplay';
        this.#statsDisplay.className = 'ui-panel';
        uiContainer.appendChild(this.#statsDisplay);

        // Create modal container
        this.#modalContainer = document.createElement('div');
        this.#modalContainer.id = 'modalContainer';
        this.#modalContainer.className = 'modal-container';
        uiContainer.appendChild(this.#modalContainer);

        // Create inventory panel
        this.#inventoryPanel = document.createElement('div');
        this.#inventoryPanel.id = 'inventoryPanel';
        this.#inventoryPanel.className = 'ui-panel inventory';
        uiContainer.appendChild(this.#inventoryPanel);

        this.#setupEventListeners();
        this.#createStyles();
    }

    #createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #uiContainer {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
            }

            .ui-panel {
                position: absolute;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 10px;
                border-radius: 5px;
                pointer-events: auto;
            }

            #statsDisplay {
                top: 10px;
                left: 10px;
                min-width: 150px;
            }

            #inventoryPanel {
                top: 10px;
                right: 10px;
                min-width: 200px;
                display: none;
            }

            .modal-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                pointer-events: auto;
            }

            .modal {
                background: #fff;
                padding: 20px;
                border-radius: 8px;
                max-width: 80%;
                max-height: 80%;
                overflow-y: auto;
                color: #333;
            }

            .modal-header {
                font-size: 1.2em;
                font-weight: bold;
                margin-bottom: 10px;
            }

            .modal-content {
                margin-bottom: 15px;
            }

            .modal-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }

            .modal-button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                background: #4a90e2;
                color: white;
            }

            .modal-button:hover {
                background: #357abd;
            }
        `;
        document.head.appendChild(style);
    }

    #setupEventListeners() {
        this.#eventManager.subscribe('updateStats', (stats) => {
            this.updateStats(stats);
        });

        this.#eventManager.subscribe('showModal', (modalData) => {
            this.showModal(modalData);
        });

        this.#eventManager.subscribe('toggleInventory', () => {
            this.toggleInventory();
        });
    }

    updateStats(stats) {
        if (!stats) return;
        
        this.#statsDisplay.innerHTML = `
            <div>HP: ${stats.hp}/${stats.maxHp}</div>
            <div>Level: ${stats.level}</div>
            <div>XP: ${stats.xp}/${stats.xpToNext}</div>
            <div>Floor: ${stats.currentFloor}</div>
        `;
    }

    showModal({ title, content, buttons = [] }) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-header">${title}</div>
            <div class="modal-content">${content}</div>
            <div class="modal-buttons"></div>
        `;

        const buttonContainer = modal.querySelector('.modal-buttons');
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = 'modal-button';
            btn.textContent = button.text;
            btn.onclick = () => {
                button.action();
                this.hideModal();
            };
            buttonContainer.appendChild(btn);
        });

        this.#modalContainer.innerHTML = '';
        this.#modalContainer.appendChild(modal);
        this.#modalContainer.style.display = 'flex';
    }

    hideModal() {
        this.#modalContainer.style.display = 'none';
        this.#modalContainer.innerHTML = '';
    }

    toggleInventory() {
        const isVisible = this.#inventoryPanel.style.display === 'block';
        this.#inventoryPanel.style.display = isVisible ? 'none' : 'block';
    }

    updateInventory(items) {
        if (!items) return;

        this.#inventoryPanel.innerHTML = `
            <div class="inventory-header">Inventory</div>
            <div class="inventory-content">
                ${items.map(item => `
                    <div class="inventory-item">
                        ${item.name} ${item.quantity > 1 ? `(${item.quantity})` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
}
