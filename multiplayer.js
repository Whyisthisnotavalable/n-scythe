if (typeof Peer === "undefined") {
	const script = document.createElement("script");
	script.src = "https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js"
	script.onload = initP2P;
	document.head.appendChild(script);
} else {
	initP2P();
}
function initP2P() {
	(function () {
        class P2PConnectionManager {
            constructor(peer, config) {
                this.peer = peer;
                this.config = config || {};
                this._openHandler = null;
                this._connectionHandler = null;
                this._errorHandler = null;
                this._defaultOutgoingOpen = null;
                this._defaultOutgoingError = null;
            }

            onOpen(handler) {
                this._openHandler = handler;
                this.peer.on("open", handler);
                return this;
            }
            onConnection(handler) {
                this._connectionHandler = handler;
                this.peer.on("connection", handler);
                return this;
            }
            onError(handler) {
                this._errorHandler = handler;
                this.peer.on("error", handler);
                return this;
            }

            setDefaultOutgoingHandlers({ onOpen, onError } = {}) {
                this._defaultOutgoingOpen = onOpen || null;
                this._defaultOutgoingError = onError || null;
                return this;
            }

            connectTo(remoteId, { onOpen, onError } = {}) {
                const conn = this.peer.connect(remoteId);
                const openCb = onOpen || this._defaultOutgoingOpen;
                const errCb = onError || this._defaultOutgoingError;
                if (openCb) conn.on("open", () => openCb(conn));
                if (errCb) conn.on("error", (err) => errCb(err, conn));
                return conn;
            }

            replacePeer(newPeer) {
                this.peer = newPeer;
                if (this._openHandler) this.peer.on("open", this._openHandler);
                if (this._connectionHandler) this.peer.on("connection", this._connectionHandler);
                if (this._errorHandler) this.peer.on("error", this._errorHandler);
                return this;
            }

            reconnect() {
                if (!this.peer) return;
                try {
                    if (typeof this.peer.reconnect === "function") this.peer.reconnect();
                    return this.peer;
                } catch (e) {
                    const newPeer = new Peer({
                        host: this.config.peerHost,
                        path: this.config.peerPath,
                        debug: this.config.debug ? 2 : 0,
                    });
                    this.replacePeer(newPeer);
                    return newPeer;
                }
            }
        }
		const CONFIG = {
			peerHost: "0.peerjs.com",
			peerPath: "/",
			updateInterval: 50,
			debug: true,
		};
		const peer = new Peer({
			host: CONFIG.peerHost,
			path: CONFIG.peerPath,
			debug: CONFIG.debug ? 2 : 0,
		});
        const connManager = new P2PConnectionManager(peer);
        connManager.config = CONFIG;
		let connections = [];
		const clientId = Math.floor(Math.random() * 256);
        window.username = "unnamed player";
        window.oldUsername = "";
		let lastUpdateTime = 0;
		window.remotePlayers = {};
        const techList = [];
        let oldTech = {};
        window.receivedLevelData = false;
        window.seedUpdateInProgress = false;
        window.lastSeedUpdateTime = 0;
        window.remotePlayerLevel = new Map();
        const seedUpdateCD = 1000;
		const BinaryProtocol = {
			writeUint8: (view, offset, value) => {
				view.setUint8(offset, value);
				return offset + 1;
			},
			writeUint16: (view, offset, value) => {
				view.setUint16(offset, value, true);
				return offset + 2;
			},
			writeUint32: (view, offset, value) => {
				view.setUint32(offset, value, true);
				return offset + 4;
			},
			writeFloat32: (view, offset, value) => {
				view.setFloat32(offset, value, true);
				return offset + 4;
			},
			writeFloat64: (view, offset, value) => {
				view.setFloat64(offset, value, true);
				return offset + 8;
			},
			writeBoolean: (view, offset, value) => {
				view.setUint8(offset, value ? 1 : 0);
				return offset + 1;
			},
			writeString: (view, offset, value) => {
				const encoder = new TextEncoder();
				const encoded = encoder.encode(value);
				offset = BinaryProtocol.writeUint16(view, offset, encoded.length);
				new Uint8Array(view.buffer).set(encoded, offset);
				return offset + encoded.length;
			},
			readUint8: (view, offset) => [view.getUint8(offset), offset + 1],
			readUint16: (view, offset) => [view.getUint16(offset, true), offset + 2],
			readUint32: (view, offset) => [view.getUint32(offset, true), offset + 4],
			readFloat32: (view, offset) => [
				view.getFloat32(offset, true),
				offset + 4,
			],
			readFloat64: (view, offset) => [
				view.getFloat64(offset, true),
				offset + 8,
			],
			readBoolean: (view, offset) => [view.getUint8(offset) === 1, offset + 1],
			readString: (view, offset) => {
				const [length, newOffset] = BinaryProtocol.readUint16(view, offset);
				const decoder = new TextDecoder();
				const str = decoder.decode(
					new Uint8Array(view.buffer, newOffset, length)
				);
				return [str, newOffset + length];
			},
		};

		const protocol = {
			sync_request: 0x00,
			sync: 0x01,
			next_level: 0x02,

			player_join: 0x10,
			player_leave: 0x11,
			player_movement: 0x12,
            player_level: 0x13,
			player_input: 0x14,
			player_health: 0x16,
            player_tech: 0x17,
            player_tech_request: 0x18,
            player_username: 0x19,
            player_username_request: 0x20,
            hole: 0x21,
            rewind: 0x22,
            molecular_mode: 0x23,

            block_create: 0x35,
            block_update: 0x36,
            block_remove: 0x37,
            block_request_all: 0x38,
            block_all_data: 0x39,
            seed_sync: 0x3A,
            seed_request: 0x3B,

			game_event: 0x50,
			chat_message: 0x51,

            damage: 0x60,

            peer_list: 0x70,

            level_seed: 0x80,
		};
        const knownBlocks = new Set();
        let nextBlockId = 1;
        const remoteIdToBlock = new Map();
        const blockToRemoteId = new WeakMap();
        const block_update_interval = 150;
        window.agreedSeed = null;
        window.currentLevelId = null;
        const splash = document.getElementById('splash');
        const textHTML = `
            <g class="fade-in" transform="translate(400, 700)">
                <rect class="pulse-box" x="-230" y="-30" width="460" height="85" rx="0" fill="none" stroke="#000" stroke-width="3" opacity="0">
                    <animate attributeName="opacity" values="0;1;1;0" dur="5s" begin="1s" fill="freeze" />
                    <animate attributeName="width" values="460;480;460" dur="0.2s" begin="1s" repeatCount="15" />
                    <animate attributeName="height" values="85;95;85" dur="0.2s" begin="1s" repeatCount="15" />
                    <animate attributeName="x" values="-230;-240;-230" dur="0.2s" begin="1s" repeatCount="15" />
                    <animate attributeName="y" values="-30;-35;-30" dur="0.2s" begin="1s" repeatCount="15" />
                </rect>
                
                <text text-anchor="middle" fill="#666" font-size="14px" font-family="Arial, sans-serif">
                    <tspan x="0" y="-5">Make sure all players are connected before starting.</tspan>
                    <tspan x="0" y="15">Set a seed, otherwise levels will be random and players invisible.</tspan>
                    <tspan x="0" y="35">Wait a few seconds before playing.</tspan>
                </text>
            </g>
        `;
        splash.insertAdjacentHTML('beforeend', textHTML);
		const style = document.createElement("style");
		style.textContent = `
            .status-connected {
                color: #4CAF50;
            }
            .status-disconnected {
                color: #f44336;
            }
            .status-connecting {
                color: #FF9800;
            }
            #p2p-id-display {
                user-select: all;
                background: rgba(255, 255, 255, 0.1);
                padding: 4px 8px;
                border-radius: 4px;
                margin-right: 5px;
            }
            .copy-button {
                background: white;
                color: black;
                border: 1px solid black;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 15px;
                position: relative;
                overflow: hidden;
            }
            .copy-button:hover {
                background: lightgray;
            }
            .connection-button {
                padding: 4px 8px;
                border-radius: 6px;
                border: 1px solid black;
                background: white;
                color: black;
                cursor: pointer;
                position: relative;
                overflow: hidden;
                font-size: 15px;
            }
            .connection-button:hover {
                background: lightgray;
            }
            .id-container {
                display: flex;
                align-items: center;
            }
            h3 {
                margin: 0 0 15px 0;
                font-size: 16px;
                border-bottom: 1px solid #444;
                padding-bottom: 8px;
            }
            `;
		document.head.appendChild(style);
		const container = document.createElement("details");
		container.id = "multiplayer-details";
		container.innerHTML = `
        <summary>multiplayer</summary>
        <div class="details-div" style="max-width: 50rem;">
            <div class="id-container">
                <span>Your ID:</span>
                <span id="p2p-id-display">...</span>
                <button class="copy-button" id="p2p-copy-id">Copy</button>
            </div>
            <div>Client ID: <span id="client-id-display">${clientId}</span></div>
            <div>
                <label for="p2p-username">Username:</label>
                <input type="text" id="p2p-username" placeholder="Enter username" maxlength="20">
            </div>
            <input type="text" id="p2p-remote-id" placeholder="Friend's ID">
            <button id="p2p-connect" class="connection-button">Connect</button>
            <div id="p2p-status">Status: <span class="status-disconnected">Disconnected</span></div>
        </div>
        `;
		const infoSection = document.getElementById('info');
        infoSection.insertBefore(container, infoSection.firstChild);
		document.getElementById("p2p-copy-id").addEventListener("click", () => {
			const idDisplay = document.getElementById("p2p-id-display");
			if (idDisplay.textContent !== "...") {
				navigator.clipboard
					.writeText(idDisplay.textContent)
					.then(() => {
						const copyButton = document.getElementById("p2p-copy-id");
						const originalText = copyButton.textContent;
						copyButton.textContent = "Copied!";
						setTimeout(() => {
							copyButton.textContent = originalText;
						}, 2000);
					})
					.catch((err) => {
						console.error("Failed to copy: ", err);
					});
			}
		});
        document.getElementById("p2p-username").addEventListener("input", (e) => {
            window.username = e.target.value.trim() || "unnamed player";
            window.oldUsername = window.username;
            localStorage.setItem('p2pUsername', username);
            sendUsernameUpdate();
        });
        const savedUsername = localStorage.getItem('p2pUsername');
        if (savedUsername) {
            username = savedUsername;
            document.getElementById("p2p-username").value = username;
        } else {
            username = "unnamed player";
            localStorage.setItem('p2pUsername', username);
            document.getElementById("p2p-username").value = username;
        }
        const seedInput = document.getElementById("seed");
        if (seedInput) {
            seedInput.addEventListener("input", debounce(() => {
                const value = seedInput.value.trim();
                if (value !== "" && !seedUpdateInProgress) {
                    sendSeedSync(value);
                } else {
                    sendSeedSync(seedInput.placeholder || "");
                }
            }, 500));
        }
		function updateStatus(text, statusClass) {
			const statusElement = document.getElementById("p2p-status");
			statusElement.innerHTML = `Status: <span class="${statusClass}">${text}</span>`;
		}
		function log(message, level = "info") {
            if (!CONFIG.debug) return;
            let lineInfo = "";
            try {
                const err = new Error();
                const stack = err.stack.split("\n");
                const caller = stack[2] || stack[1] || "";
                const match = caller.match(/(\/[^)]+:\d+:\d+)/);
                if (match) {
                    lineInfo = ` ${match[1]}`;
                }
            } catch (_) {
                lineInfo = "";
            }
            const prefix = `[P2P${lineInfo}] `;
            switch (level) {
                case "error":
                    console.error(prefix + message);
                    break;
                case "warn":
                    console.warn(prefix + message);
                    break;
                default:
                    console.log(prefix + message);
                    break;
            }
        }
        const processedMessages = new Set();
        const message_ttl = 1000 * 60;
        const clientLastSeen = {};
        const connToSenders = new Map();
        function removeRemotePlayer(id) {
            if (!remotePlayers[id]) return;
            Composite.remove(engine.world, remotePlayers[id]);
            const idx = mob.findIndex(m => m.id === id);
            if (idx !== -1) mob.splice(idx, 1);
            simulation.inGameConsole(`${remotePlayers[id].username} left the game`);
            delete remotePlayers[id];
        }
        function handleBinaryPacket(buffer, sourceConn) {
            const messageId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
            if (processedMessages.has(messageId)) return;
            processedMessages.add(messageId);
            setTimeout(() => processedMessages.delete(messageId), message_ttl);

			const view = new DataView(buffer);
			let offset = 0;
			const [packetType, offset1] = BinaryProtocol.readUint8(view, offset);
            const [senderId, currentOffset] = BinaryProtocol.readUint8(view, offset1);
            offset = currentOffset;

            clientLastSeen[senderId] = performance.now ? performance.now() : Date.now();
            if (sourceConn) {
                const set = connToSenders.get(sourceConn);
                if (set) set.add(senderId);
            }

			try {
				switch (packetType) {
                    case protocol.player_username: {
                        const [receivedUsername, offset1] = BinaryProtocol.readString(view, offset);
                        if (remotePlayers[senderId]) {
                            remotePlayers[senderId].username = receivedUsername;
                        }
                        break;
                    }
                    case protocol.chat_message: {
                        const [chat, offset1] = BinaryProtocol.readString(view, offset);
                        simulation.inGameConsole(chat);
                        break;
                    }
                    case protocol.player_username_request: {
                        sendUsernameUpdate();
                        break;
                    }
                    case protocol.hole: {
                        const [x1, offset1] = BinaryProtocol.readFloat64(view, offset);
                        const [y1, offset2] = BinaryProtocol.readFloat64(view, offset1);
                        const [x2, offset3] = BinaryProtocol.readFloat64(view, offset2);
                        const [y2, offset4] = BinaryProtocol.readFloat64(view, offset3);
                        if(remotePlayers[senderId]) {
                            remotePlayers[senderId].hole.pos1.x = x1;
                            remotePlayers[senderId].hole.pos1.y = y1;
                            remotePlayers[senderId].hole.pos2.x = x2;
                            remotePlayers[senderId].hole.pos2.y = y2;
                        }
                        break;
                    }
                    case protocol.rewind: {
                        const [rewind, offset1] = BinaryProtocol.readBoolean(view, offset);
                        const [paused, offset2] = BinaryProtocol.readBoolean(view, offset1);
                        if(remotePlayers[senderId]) {
                            remotePlayers[senderId].isRewindMode = rewind;
                            remotePlayers[senderId].isTimeDilated = paused;
                        }
                        break;
                    }
                    case protocol.molecular_mode: {
                        const [type, offset1] = BinaryProtocol.readUint8(view, offset);
                        if(remotePlayers[senderId]) {
                            remotePlayers[senderId].molecularMode = type;
                        }
                        break;
                    }
                    case protocol.player_level: {
                        const [levelId] = BinaryProtocol.readUint8(view, offset);
                        if(remotePlayers) {
                            if(!remotePlayers[senderId]) return;
                            remotePlayers[senderId].level = levelId;
                            
                            if (remotePlayers[senderId].level != level.onLevel) {
                                remotePlayers[senderId].updateBlocks = false;
                            } else {
                                remotePlayers[senderId].updateBlocks = true;
                            }
                        } else {
                            if(!alive) return;
                            remotePlayers[senderId] = spawnPlayer(0, 0, senderId);
                            safeRemoveAllTechForPlayer(senderId);
                            requestTechUpdate();
                        }
                        break;
                    }
					case protocol.player_movement: {
                        const [x, offset1] = BinaryProtocol.readFloat64(view, offset);
                        const [y, offset2] = BinaryProtocol.readFloat64(view, offset1);
                        const [velocityX, offset3] = BinaryProtocol.readFloat64(view, offset2);
                        const [velocityY, offset4] = BinaryProtocol.readFloat64(view, offset3);
                        const [rotation, offset5] = BinaryProtocol.readFloat64(view, offset4);
                        const [alive, offset6] = BinaryProtocol.readBoolean(view, offset5);
                        const [gunType, offset7] = BinaryProtocol.readUint8(view, offset6);
                        const [mouseX, offset8] = BinaryProtocol.readFloat64(view, offset7);
                        const [mouseY, offset9] = BinaryProtocol.readFloat64(view, offset8);
                        const [fieldMode, offset10] = BinaryProtocol.readUint8(view, offset9);
                        const [fireRate, offset11] = BinaryProtocol.readFloat64(view, offset10);

                        if (!remotePlayers[senderId]) {
                            if(!alive) return;
                            remotePlayers[senderId] = spawnPlayer(x, y, senderId);
                            safeRemoveAllTechForPlayer(senderId);
                            requestTechUpdate();
                        } else if(remotePlayers[senderId] && alive && m.alive) {
                            if(mob.findIndex(m => m.id === senderId) == -1) {
                                delete remotePlayers[senderId];
                            }
                            const remotePlayer = remotePlayers[senderId];
                            const distance = Matter.Vector.magnitude(Matter.Vector.sub(remotePlayer ? remotePlayer.position : player.position, {x, y}));
                            if(distance > 1.5) {
                                Matter.Body.setPosition(remotePlayer, { x, y });
                            }
                            Matter.Body.setVelocity(remotePlayer, { x: velocityX, y: velocityY})
                            remotePlayer.angle2 = rotation;
                            remotePlayer.gunType = gunType;
                            remotePlayer.mouse.x = mouseX;
                            remotePlayer.mouse.y = mouseY;
                            remotePlayer.fieldMode = fieldMode;
                            remotePlayer.fireCDscale = fireRate;
                        } else {
                            return;
                        }
						break;
                    }
					case protocol.player_input: {
                        const [up, offset1] = BinaryProtocol.readBoolean(view, offset);
                        const [down, offset2] = BinaryProtocol.readBoolean(view, offset1);
                        const [left, offset3] = BinaryProtocol.readBoolean(view, offset2);
                        const [right, offset4] = BinaryProtocol.readBoolean(view, offset3);
                        const [fire, offset5] = BinaryProtocol.readBoolean(view, offset4);
                        const [field, offset6] = BinaryProtocol.readBoolean(view, offset5);

                        if (remotePlayers[senderId]) {
                            const remotePlayer = remotePlayers[senderId];
                            remotePlayer.inputUp = up;
                            remotePlayer.inputDown = down;
                            remotePlayer.inputLeft = left;
                            remotePlayer.inputRight = right;
                            remotePlayer.inputFire = fire;
                            remotePlayer.inputField = field;
                        }
						break;
                    }
                    case protocol.player_tech: {
                        const [techIndex, offset1] = BinaryProtocol.readUint16(view, offset);
                        const [typeFlag, offset2] = BinaryProtocol.readUint8(view, offset1);
                        let techValue, newOffset;
                        if (typeFlag === 0) {
                            [techValue, newOffset] = BinaryProtocol.readFloat64(view, offset2);
                        } else if (typeFlag === 1) {
                            [techValue, newOffset] = BinaryProtocol.readString(view, offset2);
                        } else if (typeFlag === 2) {
                            [techValue, newOffset] = BinaryProtocol.readBoolean(view, offset2);
                        }
                        if (remotePlayers[senderId]) {
                            if (!remotePlayers[senderId].tech) remotePlayers[senderId].tech = {};
                            const techKey = techList[techIndex];
                            remotePlayers[senderId].tech[techKey] = techValue;
                        }
                        break;
                    }
                    case protocol.player_tech_request: {
                        for (const item of techList) {
                            sendTechUpdate(item, tech[item]);
                        }
                        break;
                    }
					case protocol.player_join:
                        if(remotePlayers[senderId]) {
                            if(remotePlayers[senderId].username) {
                                simulation.inGameConsole(`${remotePlayers[senderId].username} joined the game`);
                            }
                        } else requestUsername();
                        break;
                    case protocol.player_health: {
                        const [maxEnergy, offset1] = BinaryProtocol.readFloat64(view, offset);
                        const [energy, offset2] = BinaryProtocol.readFloat64(view, offset1);
                        const [maxHealth, offset3] = BinaryProtocol.readFloat64(view, offset2);
                        const [health, offset4] = BinaryProtocol.readFloat64(view, offset3);

                        if (remotePlayers[senderId]) {
                            const remotePlayer = remotePlayers[senderId];
                            remotePlayer.health = health * 100;
                            remotePlayer.energy = energy;
                            remotePlayer.maxHealth = maxHealth * 100;
                            remotePlayer.maxEnergy = maxEnergy
                        }
                        break;
                    }
                    case protocol.damage: {
                        const [damage, offset1] = BinaryProtocol.readFloat64(view, offset);

                        if (senderId === clientId) m.takeDamage(damage);
                        break;
                    }
                    case protocol.block_create: {
                        if(remotePlayers[senderId] && !remotePlayers[senderId].updateBlocks) return;
                        const [blockId, offset1] = BinaryProtocol.readString(view, offset);
                        const [posX, offset2] = BinaryProtocol.readFloat64(view, offset1);
                        const [posY, offset3] = BinaryProtocol.readFloat64(view, offset2);
                        const [angle, offset4] = BinaryProtocol.readFloat64(view, offset3);
                        const [verticesCount, offset5] = BinaryProtocol.readUint8(view, offset4);
                        
                        const vertices = [];
                        let currentOffset = offset5;
                        
                        for (let i = 0; i < verticesCount; i++) {
                            const [vx, offset6] = BinaryProtocol.readFloat64(view, currentOffset);
                            const [vy, offset7] = BinaryProtocol.readFloat64(view, offset6);
                            vertices.push(Matter.Vector.create(vx, vy));
                            currentOffset = offset7;
                        }
                        
                        createRemoteBlock(blockId, posX, posY, angle, vertices, senderId);
                        break;
                    }
                    case protocol.block_update: {
                        if(remotePlayers[senderId] && !remotePlayers[senderId].updateBlocks) return;
                        const [blockId, offset1] = BinaryProtocol.readString(view, offset);
                        const [posX, offset2] = BinaryProtocol.readFloat64(view, offset1);
                        const [posY, offset3] = BinaryProtocol.readFloat64(view, offset2);
                        const [angle, offset4] = BinaryProtocol.readFloat64(view, offset3);
                        const [velX, offset5] = BinaryProtocol.readFloat64(view, offset4);
                        const [velY, offset6] = BinaryProtocol.readFloat64(view, offset5);
                        const [angularVel, offset7] = BinaryProtocol.readFloat64(view, offset6);
                        const [force, offset8] = BinaryProtocol.readBoolean(view, offset7);
                        
                        updateRemoteBlock(blockId, posX, posY, angle, velX, velY, angularVel, senderId, force);
                        break;
                    }
                    case protocol.block_remove: {
                        if(remotePlayers[senderId] && !remotePlayers[senderId].updateBlocks) return;
                        const [blockId, offset1] = BinaryProtocol.readUint16(view, offset);
                        removeRemoteBlock(blockId, senderId);
                        break;
                    }
                    case protocol.block_request_all: {
                        sendAllBlocks(senderId);
                        break;
                    }
                    case protocol.block_all_data: {
                        if(remotePlayers[senderId] && !remotePlayers[senderId].updateBlocks) return;
                        const [blocksCount, offset1] = BinaryProtocol.readUint16(view, offset);
                        let currentOffset = offset1;
                        
                        for (let i = 0; i < blocksCount; i++) {
                            const [blockId, offset2] = BinaryProtocol.readUint16(view, currentOffset);
                            const [posX, offset3] = BinaryProtocol.readFloat64(view, offset2);
                            const [posY, offset4] = BinaryProtocol.readFloat64(view, offset3);
                            const [angle, offset5] = BinaryProtocol.readFloat64(view, offset4);
                            const [verticesCount, offset6] = BinaryProtocol.readUint8(view, offset5);
                            
                            const vertices = [];
                            currentOffset = offset6;
                            
                            for (let j = 0; j < verticesCount; j++) {
                                const [vx, offset7] = BinaryProtocol.readFloat64(view, currentOffset);
                                const [vy, offset8] = BinaryProtocol.readFloat64(view, offset7);
                                vertices.push(Matter.Vector.create(vx, vy));
                                currentOffset = offset8;
                            }
                            
                            createRemoteBlock(blockId, posX, posY, angle, vertices, senderId);
                        }
                        break;
                    }
                    case protocol.seed_sync: {
                        const [seed, offset1] = BinaryProtocol.readString(view, offset);
                        if (senderId === clientId || seedUpdateInProgress) {
                            break;
                        }
                        const seedInput = document.getElementById("seed");
                        if (seedInput && seedInput.value !== seed) {
                            seedUpdateInProgress = true;
                            seedInput.value = seed;
                            Math.initialSeed = seed;
                            setTimeout(() => {
                                seedUpdateInProgress = false;
                            }, 100);
                        }

                        break;
                    }
                    case protocol.seed_request: {
                        sendSeedSync(Math.initialSeed)
                        break;
                    }
                    case protocol.player_leave: {
                        const [leavingId, offset1] = BinaryProtocol.readUint8(view, offset);
                        
                        if (sourceConn) {
                            const buffer = new ArrayBuffer(2);
                            const view = new DataView(buffer);
                            BinaryProtocol.writeUint8(view, 0, protocol.player_leave);
                            BinaryProtocol.writeUint8(view, 1, leavingId);
                            
                            for (const conn of connections) {
                                if (conn !== sourceConn && conn.open) {
                                    try {
                                        conn.send(buffer);
                                    } catch (e) {
                                        console.error("Error forwarding leave message:", e);
                                    }
                                }
                            }
                        }
                        removeRemotePlayer(leavingId);
                        break;
                    }
					default:
						log(`Unhandled packet type: 0x${packetType.toString(16)}`, "warn");
				}
			} catch (error) {
                log(
                    `Packet handling error: ${error}\n` +
                    `packetType: 0x${packetType?.toString(16)}\n` +
                    `senderId: ${senderId}\n` +
                    `offset: ${offset}\n` +
                    `buffer length: ${view.byteLength}\n` +
                    `stack: ${error.stack}`,
                    "error"
                );
			}
		}
		function sendPlayerMovement(x, y, velocityX, velocityY, rotation, alive, gunType, mouseX, mouseY, fieldMode) {
			const buffer = new ArrayBuffer(69);
			const view = new DataView(buffer);
			let offset = BinaryProtocol.writeUint8(view, 0, protocol.player_movement);
			offset = BinaryProtocol.writeUint8(view, offset, clientId);
			offset = BinaryProtocol.writeFloat64(view, offset, x);
			offset = BinaryProtocol.writeFloat64(view, offset, y);
			offset = BinaryProtocol.writeFloat64(view, offset, velocityX);
			offset = BinaryProtocol.writeFloat64(view, offset, velocityY);
			offset = BinaryProtocol.writeFloat64(view, offset, rotation);
			offset = BinaryProtocol.writeBoolean(view, offset, alive);
            offset = BinaryProtocol.writeUint8(view, offset, gunType == null ? 255 : gunType);
            offset = BinaryProtocol.writeFloat64(view, offset, mouseX);
			offset = BinaryProtocol.writeFloat64(view, offset, mouseY);
            offset = BinaryProtocol.writeUint8(view, offset, fieldMode == null ? 255 : fieldMode);
            offset = BinaryProtocol.writeFloat64(view, offset, b.fireCDscale);

			sendData(buffer);
		}
		function sendMisc(health = m.health, maxHealth = m.maxHealth, energy = m.energy, maxEnergy = m.maxEnergy) {
			const buffer = new ArrayBuffer(34);
			const view = new DataView(buffer);
			let offset = BinaryProtocol.writeUint8(view, 0, protocol.player_health);
			offset = BinaryProtocol.writeUint8(view, offset, clientId);
			offset = BinaryProtocol.writeFloat64(view, offset, maxEnergy);
			offset = BinaryProtocol.writeFloat64(view, offset, energy);
			offset = BinaryProtocol.writeFloat64(view, offset, maxHealth);
			offset = BinaryProtocol.writeFloat64(view, offset, health);

			sendData(buffer);
		}
        function sendPlayerLevel(levelId) {
            const buffer = new ArrayBuffer(3);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.player_level);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            offset = BinaryProtocol.writeUint8(view, offset, levelId);

            sendData(buffer);
        }
        function sendFullTechSync(connection) {
            for (const item of techList) {
                const value = tech[item];
                let buffer, view, offset;
                if (typeof value === "number") {
                    buffer = new ArrayBuffer(13);
                    view = new DataView(buffer);
                    offset = BinaryProtocol.writeUint8(view, 0, protocol.player_tech);
                    offset = BinaryProtocol.writeUint8(view, offset, clientId);
                    offset = BinaryProtocol.writeUint16(view, offset, techList.indexOf(item));
                    offset = BinaryProtocol.writeUint8(view, offset, 0);
                    offset = BinaryProtocol.writeFloat64(view, offset, value);
                } else if (typeof value === "string") {
                    const encoder = new TextEncoder();
                    const encoded = encoder.encode(value);
                    buffer = new ArrayBuffer(1 + 1 + 2 + 1 + 2 + encoded.length);
                    view = new DataView(buffer);
                    offset = BinaryProtocol.writeUint8(view, 0, protocol.player_tech);
                    offset = BinaryProtocol.writeUint8(view, offset, clientId);
                    offset = BinaryProtocol.writeUint16(view, offset, techList.indexOf(item));
                    offset = BinaryProtocol.writeUint8(view, offset, 1);
                    offset = BinaryProtocol.writeUint16(view, offset, encoded.length);
                    new Uint8Array(buffer, offset).set(encoded);
                    offset += encoded.length;
                } else if (typeof value === "boolean") {
                    buffer = new ArrayBuffer(6);
                    view = new DataView(buffer);
                    offset = BinaryProtocol.writeUint8(view, 0, protocol.player_tech);
                    offset = BinaryProtocol.writeUint8(view, offset, clientId);
                    offset = BinaryProtocol.writeUint16(view, offset, techList.indexOf(item));
                    offset = BinaryProtocol.writeUint8(view, offset, 2); 
                    offset = BinaryProtocol.writeBoolean(view, offset, value);
                } else {
                    continue;
                }
                if (connection.open) {
                    connection.send(buffer);
                }
            }
        }
        function checkAndSendTechUpdates() {
            for (const item of techList) {
                if (tech[item] !== oldTech[item]) {
                    sendTechUpdate(item, tech[item]);
                    oldTech[item] = tech[item];
                }
            }
        }
        function sendTechUpdate(techKey, techValue) {
            const techIndex = techList.indexOf(techKey);
            if (techValue === undefined || techIndex === -1) return;
            let buffer, view, offset;
            if (typeof techValue === "number") {
                buffer = new ArrayBuffer(13);
                view = new DataView(buffer);
                offset = BinaryProtocol.writeUint8(view, 0, protocol.player_tech);
                offset = BinaryProtocol.writeUint8(view, offset, clientId);
                offset = BinaryProtocol.writeUint16(view, offset, techIndex);
                offset = BinaryProtocol.writeUint8(view, offset, 0);
                offset = BinaryProtocol.writeFloat64(view, offset, techValue);
            } else if (typeof techValue === "string") {
                const encoder = new TextEncoder();
                const encoded = encoder.encode(techValue);
                buffer = new ArrayBuffer(1 + 1 + 2 + 1 + 2 + encoded.length);
                view = new DataView(buffer);
                offset = BinaryProtocol.writeUint8(view, 0, protocol.player_tech);
                offset = BinaryProtocol.writeUint8(view, offset, clientId);
                offset = BinaryProtocol.writeUint16(view, offset, techIndex);
                offset = BinaryProtocol.writeUint8(view, offset, 1);
                offset = BinaryProtocol.writeUint16(view, offset, encoded.length);
                new Uint8Array(buffer, offset).set(encoded);
                offset += encoded.length;
            } else if (typeof techValue === "boolean") {
                buffer = new ArrayBuffer(6);
                view = new DataView(buffer);
                offset = BinaryProtocol.writeUint8(view, 0, protocol.player_tech);
                offset = BinaryProtocol.writeUint8(view, offset, clientId);
                offset = BinaryProtocol.writeUint16(view, offset, techIndex);
                offset = BinaryProtocol.writeUint8(view, offset, 2); 
                offset = BinaryProtocol.writeBoolean(view, offset, techValue);
            }

            sendData(buffer);
        }
        function requestTechUpdate() {
            const buffer = new ArrayBuffer(2);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.player_tech_request);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            
            sendData(buffer);
        }
        function sendDamage(damage, id) {
            const buffer = new ArrayBuffer(10);
			const view = new DataView(buffer);
			let offset = BinaryProtocol.writeUint8(view, 0, protocol.damage);
			offset = BinaryProtocol.writeUint8(view, offset, id);
			offset = BinaryProtocol.writeFloat64(view, offset, damage / 100);
            
            sendData(buffer);
        }
		function sendPlayerInput(inputState) {
			const buffer = new ArrayBuffer(8);
			const view = new DataView(buffer);
			let offset = BinaryProtocol.writeUint8(view, 0, protocol.player_input);
			offset = BinaryProtocol.writeUint8(view, offset, clientId);
			offset = BinaryProtocol.writeBoolean(view, offset, inputState.up);
			offset = BinaryProtocol.writeBoolean(view, offset, inputState.down);
			offset = BinaryProtocol.writeBoolean(view, offset, inputState.left);
			offset = BinaryProtocol.writeBoolean(view, offset, inputState.right);
			offset = BinaryProtocol.writeBoolean(view, offset, inputState.fire);
			offset = BinaryProtocol.writeBoolean(view, offset, inputState.field);

			sendData(buffer);
		}
		function sendPlayerJoin() {
            const buffer = new ArrayBuffer(2);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.player_join);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            sendData(buffer);
        }
        function sendUsernameUpdate() {
            const buffer = new ArrayBuffer(2 + 2 + username.length * 2);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.player_username);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            offset = BinaryProtocol.writeString(view, offset, username);
            
            sendData(buffer);
        }
        function requestUsername() {
            const buffer = new ArrayBuffer(2);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.player_username_request);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            
            sendData(buffer);
        }
        function sentChat(message) {
            const buffer = new ArrayBuffer(2 + 2 + message.length * 2);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.chat_message);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            offset = BinaryProtocol.writeString(view, offset, message);
            
            sendData(buffer);
        }
        function createRemoteBlock(blockId, x, y, angle, vertices, senderId) {
            let block = body.find(b => b.id === blockId);
            if (block) {
                block.remoteBlock = true;
                knownBlocks.add(blockId);
                remoteIdToBlock.set(blockId, block);
                return;
            }
            knownBlocks.add(blockId);
            block = Bodies.fromVertices(x, y, [vertices], {
                render: { fillStyle: '#AAAAAA' },
                friction: 0.1,
                restitution: 0.3,
                collisionFilter: {
                    category: cat.body,
                    mask: cat.player | cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet
                }
            });
            if (block) {
                block.id = blockId;
                block.remoteBlock = true;
                block.senderId = senderId;
                block.lastUpdate = 0;

                Matter.Body.setAngle(block, angle);
                Composite.add(engine.world, block);
                body.push(block);
                remoteIdToBlock.set(blockId, block);

                console.log(`[P2P] Created remote block ${blockId} from player ${senderId}`);
            }
        }

        function updateRemoteBlock(blockId, x, y, angle, velX, velY, angularVel, senderId, force) {
            const aliased = remoteIdToBlock.get(blockId);
            const block = aliased || body.find(b => b.id === blockId);
            if (!block) return;

            if (block.senderId === senderId || block.lastUpdate < Date.now() - 100 || force) {
                Matter.Body.setPosition(block, { x, y });
                Matter.Body.setAngle(block, angle);
                Matter.Body.setVelocity(block, { x: velX, y: velY });
                Matter.Body.setAngularVelocity(block, angularVel);
                block.lastUpdate = Date.now();
            }
        }
        function removeRemoteBlock(blockId, senderId) {
            const aliased = remoteIdToBlock.get(blockId);
            if (aliased && !aliased.remoteBlock) {
                remoteIdToBlock.delete(blockId);
                knownBlocks.delete(blockId);
                console.log(`[P2P] Dropped alias for remote block ${blockId}`);
                return;
            }
            const index = body.findIndex(b => b.id === blockId && b.remoteBlock);
            if (index !== -1) {
                const block = body[index];
                if (block.senderId === senderId) {
                    Composite.remove(engine.world, block);
                    body.splice(index, 1);
                    knownBlocks.delete(blockId);
                    remoteIdToBlock.delete(blockId);
                    console.log(`[P2P] Removed remote block ${blockId}`);
                }
            }
        }

        function sendAllBlocks(targetId) {
            const connection = connections.find(c => {
                const senders = connToSenders.get(c);
                return senders && senders.has(targetId);
            });

            if (!connection || !connection.open) return;

            let totalSize = 3; 
            body.forEach(block => {
                if (!block.remoteBlock) { 
                    totalSize += 2; 
                    totalSize += 8 * 3; 
                    totalSize += 1; 
                    totalSize += 8 * 2 * block.vertices.length; 
                }
            });

            const buffer = new ArrayBuffer(totalSize);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.block_all_data);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            offset = BinaryProtocol.writeUint16(view, offset, body.filter(b => !b.remoteBlock).length);

            body.forEach(block => {
                if (!block.remoteBlock) {
                    const outId = blockToRemoteId.get(block) || block.id;
                    offset = BinaryProtocol.writeUint16(view, offset, outId);
                    offset = BinaryProtocol.writeFloat64(view, offset, block.position.x);
                    offset = BinaryProtocol.writeFloat64(view, offset, block.position.y);
                    offset = BinaryProtocol.writeFloat64(view, offset, block.angle);
                    offset = BinaryProtocol.writeUint8(view, offset, block.vertices.length);

                    block.vertices.forEach(vertex => {
                        offset = BinaryProtocol.writeFloat64(view, offset, vertex.x);
                        offset = BinaryProtocol.writeFloat64(view, offset, vertex.y);
                    });
                }
            });

            connection.send(buffer);
        }
        function sendBlockCreate(block) {
            const encodedId = new TextEncoder().encode(block.id);
            const idLength = encodedId.length;
            const bufferLength = 1 + 1 + 2 + idLength + 8 * 3 + 1 + 16 * block.vertices.length;
            const buffer = new ArrayBuffer(bufferLength);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.block_create);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            offset = BinaryProtocol.writeString(view, offset, block.id);
            offset = BinaryProtocol.writeFloat64(view, offset, block.position.x);
            offset = BinaryProtocol.writeFloat64(view, offset, block.position.y);
            offset = BinaryProtocol.writeFloat64(view, offset, block.angle);
            offset = BinaryProtocol.writeUint8(view, offset, block.vertices.length);

            block.vertices.forEach(vertex => {
                offset = BinaryProtocol.writeFloat64(view, offset, vertex.x);
                offset = BinaryProtocol.writeFloat64(view, offset, vertex.y);
            });

            sendData(buffer);
        }
        function sendBlockUpdate(block, force = false) {
            const buffer = new ArrayBuffer(1 + 1 + 2 + block.id.length + 6 * 8 + 1);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.block_update);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            offset = BinaryProtocol.writeString(view, offset, block.id);
            offset = BinaryProtocol.writeFloat64(view, offset, block.position.x);
            offset = BinaryProtocol.writeFloat64(view, offset, block.position.y);
            offset = BinaryProtocol.writeFloat64(view, offset, block.angle);
            offset = BinaryProtocol.writeFloat64(view, offset, block.velocity.x);
            offset = BinaryProtocol.writeFloat64(view, offset, block.velocity.y);
            offset = BinaryProtocol.writeFloat64(view, offset, block.angularVelocity);
            offset = BinaryProtocol.writeBoolean(view, offset, force);

            sendData(buffer);
        }
        function sendBlockRemove(blockOrId) {
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.block_remove);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            let outIdRemove;
            if (typeof blockOrId === 'number') {
                outIdRemove = blockOrId;
            } else if (blockOrId && typeof blockOrId === 'object') {
                outIdRemove = blockToRemoteId.get(blockOrId) || blockOrId.id;
            }
            offset = BinaryProtocol.writeUint16(view, offset, outIdRemove);

            sendData(buffer);
        }
        function requestAllBlocks() {
            const buffer = new ArrayBuffer(2);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.block_request_all);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);

            sendData(buffer);
        }
        function sendHole() {
            if(m.fieldMode == 9 && m.hole) {
                const buffer = new ArrayBuffer(2 + 16 * 4);
                const view = new DataView(buffer);
                let offset = BinaryProtocol.writeUint8(view, 0, protocol.hole);
                offset = BinaryProtocol.writeUint8(view, offset, clientId);
                offset = BinaryProtocol.writeFloat64(view, offset, m.hole.pos1.x)
                offset = BinaryProtocol.writeFloat64(view, offset, m.hole.pos1.y)
                offset = BinaryProtocol.writeFloat64(view, offset, m.hole.pos2.x)
                offset = BinaryProtocol.writeFloat64(view, offset, m.hole.pos2.y)
                sendData(buffer);
            }
        }
        function sendRewind() {
            if(m.fieldMode == 6) {
                const buffer = new ArrayBuffer(4);
                const view = new DataView(buffer);
                let offset = BinaryProtocol.writeUint8(view, 0, protocol.rewind);
                offset = BinaryProtocol.writeUint8(view, offset, clientId);
                offset = BinaryProtocol.writeBoolean(view, offset, m.fieldUpgrades[6].isRewindMode);
                offset = BinaryProtocol.writeBoolean(view, offset, m.isTimeDilated);
                sendData(buffer);
            }
        }
        function sendMode() {
            if(m.fieldMode == 4) {
                const buffer = new ArrayBuffer(3);
                const view = new DataView(buffer);
                let offset = BinaryProtocol.writeUint8(view, 0, protocol.molecular_mode);
                offset = BinaryProtocol.writeUint8(view, offset, clientId);
                offset = BinaryProtocol.writeUint8(view, offset, simulation.molecularMode);
                sendData(buffer);
            }
        }
        function sendSeedSync(seed) {
            if (typeof seed !== "string") seed = String(seed);
            if (seedUpdateInProgress || (Date.now() - lastSeedUpdateTime < seedUpdateCD)) {
                return;
            }
            const seedInput = document.getElementById("seed");
            if (seedInput && seedInput.value !== seed) {
                seedInput.value = seed;
            }
            const encoder = new TextEncoder();
            const encoded = encoder.encode(seed);
            const buffer = new ArrayBuffer(2 + 2 + encoded.length);
            const view = new DataView(buffer);
            let offset = BinaryProtocol.writeUint8(view, 0, protocol.seed_sync);
            offset = BinaryProtocol.writeUint8(view, offset, clientId);
            offset = BinaryProtocol.writeUint16(view, offset, encoded.length);

            new Uint8Array(buffer, offset).set(encoded);
            sendData(buffer);
        }
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        function ensureBidirectional(conn) {
            if (!connections.some(c => c.peer === conn.peer)) {
                const backConn = peer.connect(conn.peer);
                backConn.on("open", () => setupConnection(backConn));
                backConn.on("error", () => {
                    
                    setTimeout(() => ensureBidirectional(conn), 2000);
                });
            }
        }
        function broadcastPeerList() {
            if (connections.length === 0) return;
            const peerList = connections.map(c => c.peer).concat(peer.id);

            for (const conn of connections) {
                if (conn.open) {
                    try {
                        conn.send({ type: "peer-list", peers: peerList });
                    } catch (e) {
                        console.error("Error sending peer list:", e);
                    }
                }
            }
        }
        function handlePeerList(peerIds, sourceConn) {
            if (peer.disconnected) {
                reconnect();
                return;
            }
            const incoming = new Set(peerIds);
            for (const id of incoming) {
                if (id !== peer.id && !connections.some(c => c.peer === id)) {
                    const conn = peer.connect(id);
                    conn.on("open", () => {
                        setupConnection(conn);
                        broadcastPeerList();
                    });
                    conn.on("error", () => {
                        console.warn("Connection failed, retrying:", id);
                        setTimeout(() => {
                            if (!connections.some(c => c.peer === id)) {
                                handlePeerList([id], sourceConn);
                            }
                        }, 2000);
                    });
                }
            }
        }
        function setupConnection(connection) {
            if (connections.some(c => c.peer === connection.peer)) return;
            connections.push(connection);
            connToSenders.set(connection, new Set());
            connection.on("data", (data) => {
                if (data instanceof ArrayBuffer) {
                    handleBinaryPacket(data, connection);
                } else if (typeof data === "object" && data.type === "peer-list") {
                    handlePeerList(data.peers, connection);
                }
            });
            connection.on("close", () => {
                const senders = connToSenders.get(connection) || new Set();
                for (const id of senders) {
                    propagatePlayerLeave(id, connection);
                    removeRemotePlayer(id);
                }
                connToSenders.delete(connection);
                connections = connections.filter(c => c !== connection);
                updateConnectionStatus();
                broadcastPeerList();
            });
            connection.on("error", () => {
                connections = connections.filter(c => c !== connection);
                updateConnectionStatus();
            });
            ensureBidirectional(connection);   
            broadcastPeerList();    
            sendPlayerJoin();
            sendPlayerLevel(level.onLevel);
            sendFullTechSync(connection);

            if (Math && Math.initialSeed) {
                sendSeedSync(Math.initialSeed);
            } else {
                const buffer = new ArrayBuffer(2);
                const view = new DataView(buffer);
                BinaryProtocol.writeUint8(view, 0, protocol.seed_request);
                BinaryProtocol.writeUint8(view, 1, clientId);
                connection.send(buffer);
            }
        }
        function validateUsernames() {
            for (const id in remotePlayers) {
                if (!remotePlayers[id].username || 
                    remotePlayers[id].username === "unnamed player" ||
                    remotePlayers[id].username === "undefined") {
                    requestUsername();
                }
            }
        }
        setInterval(validateUsernames, 5000);
		function sendData(buffer) {
            if (!buffer) return false;
            if (connections.length === 0) return false;
            
            let sent = false;
            for (const connection of connections) {
                if (connection.open) {
                    try {
                        connection.send(buffer);
                        sent = true;
                    } catch (error) {
                        log("Error sending data: " + error, "error");
                        connections = connections.filter(c => c !== connection);
                    }
                }
            }
            return sent;
        }
        function initTechList() {
            for (const item in tech) {
                if (tech[item] == null || ['boolean', 'number', 'string'].includes(typeof tech[item])) {
                    techList.push(item);
                }
            }
            for (const item of techList) {
                oldTech[item] = tech[item];
            }
        }
        function propagatePlayerLeave(leavingId, sourceConnection) {
            const buffer = new ArrayBuffer(2);
            const view = new DataView(buffer);
            BinaryProtocol.writeUint8(view, 0, protocol.player_leave);
            BinaryProtocol.writeUint8(view, 1, leavingId);
            
            
            for (const connection of connections) {
                if (connection !== sourceConnection && connection.open) {
                    try {
                        connection.send(buffer);
                    } catch (e) {
                        console.error("Error propagating leave message:", e);
                    }
                }
            }
            removeRemotePlayer(leavingId);
        }
        function monitorMeshHealth() {
            const MESH_SYNC_INTERVAL = 5000;
            setInterval(() => {
                connections = connections.filter(connection => {
                    if (!connection.open) {
                        const senders = connToSenders.get(connection) || new Set();
                        for (const id of senders) {
                            propagatePlayerLeave(id, connection);
                            removeRemotePlayer(id);
                        }
                        connToSenders.delete(connection);
                        return false;
                    }
                    return true;
                });
                updateConnectionStatus();
            }, 5000);
            setInterval(() => {
                broadcastPeerList();
            }, MESH_SYNC_INTERVAL);
        }
        function startTechSync() {
            setInterval(checkAndSendTechUpdates, 1000);
        }
        initTechList();
        startTechSync();
        function clampVelocity(v) {
            const EPS = 1e-6;
            return {
                x: Math.abs(v.x) < EPS ? 0 : v.x,
                y: Math.abs(v.y) < EPS ? 0 : v.y
            };
        }
		function monitorGameState(timestamp) {
            if (timestamp - lastUpdateTime >= CONFIG.updateInterval && connections.some(c => c.open)) {
                lastUpdateTime = timestamp;
                if (player && player.position) {
                    if(oldUsername != username) {
                        sendUsernameUpdate();
                        b2.oldUsername = username;
                    }
                    let vel = clampVelocity(player.velocity);
                    sendPlayerMovement(
                        player.position.x,
                        player.position.y,
                        vel.x || 0,
                        vel.y || 0,
                        m.angle || 0,
                        m.alive,
                        b.activeGun,
                        simulation.mouseInGame.x || 0,
                        simulation.mouseInGame.y || 0,
                        m.fieldMode,
                    );
                    sendMisc();
                } else if (!m.alive) {
                    sendPlayerMovement(
                        0,
                        0,
                        0,
                        0,
                        0,
                        m.alive,
                        b.activeGun,
                        0,
                        0,
                        m.fieldMode,
                    );
                }
                if (input) {
                    sendPlayerInput({
                        up: input.up || false,
                        down: input.down || false,
                        left: input.left || false,
                        right: input.right || false,
                        fire: input.fire || false,
                        field: input.field || false
                    });
                }
                if(m.holdingTarget) {
                    if(typeof m.holdingTarget.id == "string") sendBlockUpdate(m.holdingTarget, true);
                }
                if(m.fieldMode == 9 && m.hole) {
                    if(m.hole.pos1 && m.hole.pos2) {
                        sendHole();
                    }
                }
                if(m.fieldMode == 6) {
                    sendRewind();
                }
                if(m.fieldMode == 4) {
                    sendMode();
                }
                const now = Date.now()
                for (const b of body) {
                    if (!b || b.remoteBlock) continue
                    if (typeof b.id !== "string") continue;
                    if (!b._lastBlockUpdate || now - b._lastBlockUpdate >= block_update_interval) {
                        sendBlockUpdate(b)
                        b._lastBlockUpdate = now
                    }
                }
                sendPlayerLevel(level.onLevel);
            }
            requestAnimationFrame(monitorGameState);
        }
        function updateConnectionStatus() {
            const connectedCount = connections.filter(c => c.open).length;
            
            if (connectedCount > 0) {
                updateStatus(
                    `Connected to ${connectedCount} peers`,
                    "status-connected"
                );
            } else {
                updateStatus("Disconnected", "status-disconnected");
            }
        }
        function reconnect() {
            if (!peer) return;
            try {
                const newPeer = connManager.reconnect();
                if (newPeer && newPeer !== peer) peer = newPeer;
                updateStatus("Reconnecting...", "status-connecting");
                console.log("[P2P] Attempting to reconnect with same ID:", peer && peer.id);
            } catch (e) {
                updateStatus("Error: reconnect failed", "status-disconnected");
                console.warn("[P2P] reconnect failed:", e);
            }
        }
        connManager.onOpen((id) => {
            document.getElementById("p2p-id-display").textContent = id;
            updateStatus("Ready to connect", "status-disconnected");
            log("PeerJS initialized with ID: " + id);
            requestAnimationFrame(monitorGameState);
            monitorMeshHealth();
        })
        .onConnection((connection) => {
            setupConnection(connection);
        })
        .onError((err) => {
            if (err == "disconnected") {
            simulation.inGameConsole("connection probably lost. attemping reconnect")
            reconnect();
            }
            updateStatus("Error: " + err.type, "status-disconnected");
        });

		document.getElementById("p2p-connect").addEventListener("click", () => {
			const remoteId = document.getElementById("p2p-remote-id").value.trim();
			if (!remoteId) return alert("Please enter a Peer ID");

			updateStatus("Connecting...", "status-connecting");
			const connection = connManager.connectTo(remoteId);

			connection.on("open", () => setupConnection(connection));
			connection.on("error", (err) => {
				log("Connection failed: " + err, "error");
				updateStatus("Connection failed", "status-disconnected");
			});
		});
        function buildSafeRemoveFns() {
            for (let i = 0; i < tech.tech.length; i++) {
                const t = tech.tech[i];
                if (typeof t.remove === "function") {
                    const src = t.remove.toString();
                    const safeLines = src
                        .split("\n")
                        .map(line => line.trim())
                        .filter(line => line.startsWith("tech.") && line.includes("="))
                        .map(line => line.replace(/^tech\./, "remotePlayers[id].tech."));
                    if (safeLines.length > 0) {
                        try {
                            t.safeRemove = new Function("id", safeLines.join("\n"));
                        } catch (err) {
                            t.safeRemove = function () {};
                        }
                    } else {
                        t.safeRemove = function () {};
                    }
                } else {
                    t.safeRemove = function () {};
                }
            }
        }
        function safeRemoveAllTechForPlayer(id) {
            if (!remotePlayers[id] || !remotePlayers[id].tech) return;
            for (let i = 0; i < tech.tech.length; i++) {
                if (typeof tech.tech[i].safeRemove === "function") {
                    try {
                        tech.tech[i].safeRemove(id);
                    } catch (e) {
                        console.error("error", tech.tech[i].name, e);
                    }
                }
            }
            remotePlayers[id].tech.removeCount = 0;
            remotePlayers[id].tech.duplication = 0;
            remotePlayers[id].tech.extraMaxHealth = 0;
            remotePlayers[id].tech.totalCount = 0;
            remotePlayers[id].tech.junkChance = 0;
        }
        const oldSimulation = simulation.startGame;
        simulation.startGame = () => {
            oldSimulation();
            for (const playerKey in remotePlayers) {
                if (remotePlayers.hasOwnProperty(playerKey)) {
                    delete remotePlayers[playerKey];
                }
            }
            buildSafeRemoveFns();
            requestTechUpdate();
            validateUsernames();

            simulation.ephemera.push({
                name: "personal best", //21.45
                do() {
                    if(m.isTimeDilated) {
                        for(const id in remotePlayers) {
                            remotePlayers[id].do();
                        }
                    }
                }
            })
        }
        const oldNext = level.nextLevel;
        level.nextLevel = function() {
            oldNext();
            Math.seed = Math.initialSeed;
            agreedSeed = Math.seed;
        };
        setTimeout(validateUsernames, 10)
        function pm(obj, methodName, replacements) {
            if (typeof obj[methodName] !== "function") {
                throw new Error(`${methodName} is not a function`);
            }
            let fnStr = obj[methodName].toString();
            for (const [pattern, replacement] of replacements) {
                fnStr = fnStr.replace(pattern, replacement);
            }
            if (!/^function/.test(fnStr)) {
                fnStr = "function " + fnStr;
            }
            try {
                obj[methodName] = eval(`(${fnStr})`);
            } catch (_) {}
        }
        pm(b.guns[3], "doLongitudinal", [
            [/\bwho\.locatePlayer\(\);?/, "if(typeof who.locatePlayer == 'function') who.locatePlayer();"],
            [/\bwho\.damage\([^)]*\);?/, "if(typeof who.damage == 'function') who.damage(damage / Math.sqrt(who.radius)"]
        ]);
        function wrapAllBulletFunctions(e){
            const t={};
            for(const[r,i] of Object.entries(e)){
                if("function"==typeof i){
                let n=i.toString().trim();
                n.startsWith("function")||n.startsWith("(")||n.startsWith("async")||(n="function "+n);
                n=n.replace(/\bplayer(?=\s*[\.\[])/g,"remotePlayers[id]");
                n=n.replace(/\bplayer\b/g,"remotePlayers[id]");
                n=n.replace(/\btech\./g,"remotePlayers[id].tech.");
                n=n.replace(/\bb\.fireAttributes\s*\(([^)]*)\)/g,"b2.fireAttributes($1, id)");
                n=n.replace(/\bComposite\.add\s*\(\s*engine\.world\s*,\s*bullet\[me\]\s*\)\s*;/g,"Composite.add(engine.world, bullet[me]); bullet[me].remoteBullet = true; bullet[me].collisionFilter.group = -id;");
                const o=n.match(/function\s*[^(]*\(([^)]*)\)/);
                if(o){
                    let s=o[1].trim();
                    const a=s?s.split(",").map(e=>e.trim()).filter(Boolean):[];
                    a.includes("id")||(s=s?`${s}, id`:"id",n=n.replace(/\([^)]*\)/,`(${s})`))
                }
                let l;
                try{l=new Function(`return (${n});`)()}catch(c){l=i}
                t[r]=l;
                }else t[r]=i;
            }
            return t
        }
        window.b2 = wrapAllBulletFunctions(b);
        window.b2.fireAttributes = (dir, rotate = true, id) => {
            if (rotate) {
                return {
                    angle: dir,
                    friction: 0.5,
                    frictionAir: 0,
                    dmg: 0,
                    classType: "bullet",
                    collisionFilter: {
                        group: -id,
                        category: cat.body,
                        mask: cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield | cat.player
                    },
                    minDmgSpeed: 10,
                    beforeDmg() { },
                    onEnd() { }
                };
            } else {
                return {
                    inertia: Infinity,
                    angle: dir,
                    friction: 0.5,
                    frictionAir: 0,
                    dmg: 0,
                    classType: "bullet",
                    collisionFilter: {
                        group: -id,
                        category: cat.body,
                        mask: cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield | cat.player
                    },
                    minDmgSpeed: 10,
                    beforeDmg() { },
                    onEnd() { }
                };
            }
        }
        window.b2.fireProps = (cd, speed, dir, em, id) => {
            remotePlayers[id].fireCDcycle = remotePlayers[id].cycle + Math.floor(cd * remotePlayers[id].fireCDscale); // cool down
            Matter.Body.setVelocity(bullet[em], {
                x: 0.5 * remotePlayers[id].velocity.x + speed * Math.cos(dir),
                y: 0.5 * remotePlayers[id].velocity.y + speed * Math.sin(dir)
            });
            Composite.add(engine.world, bullet[em]); //add bullet to world
        }
        window.b2.needle = (angle, id) => {
            const em = bullet.length;
            bullet[em] = Bodies.rectangle(remotePlayers[id].pos.x + 40 * Math.cos(remotePlayers[id].angle2), remotePlayers[id].pos.y + 40 * Math.sin(remotePlayers[id].angle2), 75 * remotePlayers[id].tech.bulletSize, 0.75 * remotePlayers[id].tech.bulletSize, b2.fireAttributes(angle, true, id));
            Matter.Body.setDensity(bullet[em], 0.00001); 
            bullet[em].immuneList = []
            bullet[em].dmg = 6
            if (remotePlayers[id].tech.needleTunnel) {
                bullet[em].dmg *= 1.2;
                bullet[em].endCycle = simulation.cycle + 300;
                bullet[em].collisionFilter.mask = remotePlayers[id].tech.isShieldPierce ? 0 : cat.mobShield;
                bullet[em].collisionFilter.group = -id;
                bullet[em].isInMap = false;
                bullet[em].do = function () {
                    const whom = Matter.Query.collides(this, mob)
                    if (whom.length && this.speed > 20) { 
                        for (let i = 0, len = whom.length; i < len; i++) {
                            who = whom[i].bodyA
                            if (who && who.mob) {
                                let immune = false
                                for (let i = 0; i < this.immuneList.length; i++) { 
                                    if (this.immuneList[i] === who.id) {
                                        immune = true
                                        break
                                    }
                                }
                                if (!immune) {
                                    if (remotePlayers[id].tech.isNailCrit) {
                                        if (!who.shield && Vector.dot(Vector.normalise(Vector.sub(who.position, this.position)), Vector.normalise(this.velocity)) > 0.97 - 1 / who.radius) {
                                            b.explosion(this.position, 220 + 50 * Math.random()); 
                                        }
                                    } else if (remotePlayers[id].tech.isCritKill) b.crit(who, this)

                                    this.immuneList.push(who.id) 
                                    let dmg = this.dmg * remotePlayers[id].tech.bulletSize
                                    if (remotePlayers[id].tech.isNailRadiation) {
                                        mobs.statusDoT(who, (remotePlayers[id].tech.isFastRadiation ? 6 : 2) * remotePlayers[id].tech.bulletSize, remotePlayers[id].tech.isSlowRadiation ? 360 : (remotePlayers[id].tech.isFastRadiation ? 60 : 180)) 
                                        dmg *= 0.25
                                    }
                                    if (remotePlayers[id].tech.isCrit && who.isStunned) dmg *= 4
                                    who.damage(dmg, remotePlayers[id].tech.isShieldPierce);
                                    if (who.alive) who.foundPlayer();
                                    if (who.damageReduction) {
                                        simulation.drawList.push({ 
                                            x: this.position.x,
                                            y: this.position.y,
                                            radius: Math.log(dmg + 1.1) * 40 * who.damageReduction + 3,
                                            color: simulation.playerDmgColor,
                                            time: simulation.drawTime
                                        });
                                    }
                                }
                            }
                        }
                    } else if (Matter.Query.collides(this, map).length) { 
                        if (!this.isInMap) { 
                            this.isInMap = true
                            Matter.Body.setVelocity(this, Vector.rotate(this.velocity, 0.25 * (Math.random() - 0.5)));
                            Matter.Body.setAngle(this, Math.atan2(this.velocity.y, this.velocity.x))
                        }
                        Matter.Body.setPosition(this, Vector.add(this.position, Vector.mult(this.velocity, -0.98))) 
                    } else if (Matter.Query.collides(this, body).length) { 
                        Matter.Body.setAngularVelocity(this, 0)
                        Matter.Body.setPosition(this, Vector.add(this.position, Vector.mult(this.velocity, -0.94))) 
                    } else if (this.speed < 30) {
                        this.force.y += this.mass * 0.001; 
                    }
                };
            } else {
                bullet[em].endCycle = simulation.cycle + 100;
                bullet[em].collisionFilter.mask = remotePlayers[id].tech.isShieldPierce ? cat.body : cat.body | cat.mobShield
                bullet[em].do = function () {
                    const whom = Matter.Query.collides(this, mob)
                    if (whom.length && this.speed > 20) { 
                        for (let i = 0, len = whom.length; i < len; i++) {
                            who = whom[i].bodyA
                            if (who && who.mob) {
                                let immune = false
                                for (let i = 0; i < this.immuneList.length; i++) { 
                                    if (this.immuneList[i] === who.id) {
                                        immune = true
                                        break
                                    }
                                }
                                if (!immune) {
                                    if (remotePlayers[id].tech.isNailCrit) {
                                        if (!who.shield && Vector.dot(Vector.normalise(Vector.sub(who.position, this.position)), Vector.normalise(this.velocity)) > 0.97 - 1 / who.radius) {
                                            b.explosion(this.position, 220 + 50 * Math.random()); 
                                        }
                                    } else if (remotePlayers[id].tech.isCritKill) b.crit(who, this)

                                    this.immuneList.push(who.id) 
                                    let dmg = this.dmg * remotePlayers[id].tech.bulletSize
                                    if (remotePlayers[id].tech.isNailRadiation) {
                                        mobs.statusDoT(who, (remotePlayers[id].tech.isFastRadiation ? 6 : 2) * remotePlayers[id].tech.bulletSize, remotePlayers[id].tech.isSlowRadiation ? 360 : (remotePlayers[id].tech.isFastRadiation ? 60 : 180)) 
                                        dmg *= 0.25
                                    }
                                    if (remotePlayers[id].tech.isCrit && who.isStunned) dmg *= 4
                                    who.damage(dmg, remotePlayers[id].tech.isShieldPierce);
                                    if (who.alive) who.foundPlayer();
                                    if (who.damageReduction) {
                                        simulation.drawList.push({ 
                                            x: this.position.x,
                                            y: this.position.y,
                                            radius: Math.log(dmg + 1.1) * 40 * who.damageReduction + 3,
                                            color: simulation.playerDmgColor,
                                            time: simulation.drawTime
                                        });
                                    }
                                }
                            }
                        }
                    } else if (Matter.Query.collides(this, map).length) { 
                        this.collisionFilter.mask = 0;
                        Matter.Body.setAngularVelocity(this, 0)
                        Matter.Body.setVelocity(this, {
                            x: 0,
                            y: 0
                        });
                        this.do = function () {
                            if (!Matter.Query.collides(this, map).length) this.force.y += this.mass * 0.001;
                        }
                        if (remotePlayers[id].tech.isNeedleIce) {
                            b2.iceIX(5 + 5 * Math.random(), 2 * Math.PI * Math.random(), this.position, id) 
                            if (0.5 < Math.random()) b2.iceIX(5 + 5 * Math.random(), 2 * Math.PI * Math.random(), this.position, id)
                        }
                    } else if (this.speed < 30) {
                        this.force.y += this.mass * 0.001; 
                    }
                };
            }
            const SPEED = 90
            Matter.Body.setVelocity(bullet[em], {
                x: 0.5 * remotePlayers[id].velocity.x + SPEED * Math.cos(angle),
                y: 0.5 * remotePlayers[id].velocity.y + SPEED * Math.sin(angle)
            });
            bullet[em].remoteBullet = true;
            Composite.add(engine.world, bullet[em]); 
        }
        window.b2.missile = (where, angle, speed, size = 1, id) => {
            if (remotePlayers[id].tech.isMissileBig) {
                size *= 1.5
                if (remotePlayers[id].tech.isMissileBiggest) size *= 1.5
            }
            const me = bullet.length;
            bullet[me] = Bodies.rectangle(where.x, where.y, 30 * size, 4 * size, {
                angle: angle,
                friction: 0.5,
                frictionAir: 0.045,
                dmg: 0, //damage done in addition to the damage from momentum
                classType: "bullet",
                endCycle: simulation.cycle + Math.floor((230 + 40 * Math.random()) * remotePlayers[id].tech.bulletsLastLonger + 120 * remotePlayers[id].tech.isMissileBiggest + 60 * remotePlayers[id].tech.isMissileBig),
                collisionFilter: {
                    category: cat.bullet,
                    mask: cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield
                },
                minDmgSpeed: 10,
                lookFrequency: Math.floor(10 + Math.random() * 3),
                explodeRad: 180 + 60 * Math.random(),
                density: 0.02, //0.001 is normal
                beforeDmg() {
                    Matter.Body.setDensity(this, 0.0001); //reduce density to normal
                    this.tryToLockOn();
                    this.endCycle = 0; //bullet ends cycle after doing damage  // also triggers explosion
                },
                onEnd() {
                    if(remotePlayers[id]) {
                        b.explosion(this.position, this.explodeRad * size); //makes bullet do explosive damage at end
                        if (remotePlayers[id].tech.fragments) b.targetedNail(this.position, remotePlayers[id].tech.fragments * Math.floor(2 + 1.5 * Math.random()))
                        if (remotePlayers[id].tech.isMissileFast) {
                            simulation.ephemera.push({
                                count: 21,
                                where: this.position,
                                size: this.explodeRad * size,
                                do() {
                                    if (!remotePlayers[id].isTimeDilated) {
                                        this.count--
                                        if (this.count < 0) {
                                            simulation.removeEphemera(this)
                                            b.explosion(this.where, this.size * (remotePlayers[id].tech.isMissile2ndExplode ? 1.7 : 0.8));
                                        }
                                        // //draw outline
                                        // ctx.beginPath();
                                        // const r = this.size * Math.max((this.count) / 21, 0.7)
                                        // ctx.arc(this.where.x, this.where.y, r, 0, 2 * Math.PI);
                                        // ctx.strokeStyle = "#000"
                                        // ctx.lineWidth = 2
                                        // ctx.stroke();
                                    }
                                },
                            })
                        }
                    }
                },
                lockedOn: null,
                tryToLockOn() {
                    let closeDist = Infinity;
                    const futurePos = Vector.add(this.position, Vector.mult(this.velocity, 30)) //look for closest target to where the missile will be in 30 cycles
                    this.lockedOn = null;
                    // const futurePos = this.lockedOn ? :Vector.add(this.position, Vector.mult(this.velocity, 50))
                    let candidates = [...mob, player]
                    for (let i = 0, len = candidates.length; i < len; ++i) {
                        if(candidates[i] == player) {
                            candidates[i].alive = m.alive;
                        }
                        if (
                            candidates[i].alive && !candidates[i].isBadTarget &&
                            Matter.Query.ray(map, this.position, candidates[i].position).length === 0 &&
                            !candidates[i].isInvulnerable && candidates[i].id != id 
                        ) {
                            const futureDist = Vector.magnitude(Vector.sub(futurePos, candidates[i].position));
                            if (futureDist < closeDist) {
                                closeDist = futureDist;
                                this.lockedOn = candidates[i];
                                // this.frictionAir = 0.04; //extra friction once a target it locked
                            }
                            if (Vector.magnitude(Vector.sub(this.position, candidates[i].position) < this.explodeRad)) {
                                this.endCycle = 0; //bullet ends cycle after doing damage  //also triggers explosion
                                if(typeof candidates[i].lockedOn.damage == 'function') {
                                    candidates[i].lockedOn.damage(2 * size); //does extra damage to target
                                } else if(typeof candidates[i].lockedOn.takeDamage == 'function') {
                                    candidates[i].lockedOn.takeDamage(2 * size);
                                }
                            }
                        }
                    }
                    //explode when bullet is close enough to target
                    if (this.lockedOn && Vector.magnitude(Vector.sub(this.position, this.lockedOn.position)) < this.explodeRad) {
                        this.endCycle = 0; //bullet ends cycle after doing damage  //also triggers explosion
                        if(typeof this.lockedOn.damage == 'function') this.lockedOn.damage(4 * size); //does extra damage to target
                    }
                },
                do() {
                    if(remotePlayers[id]) {
                        if (!(remotePlayers[id].cycle % this.lookFrequency)) this.tryToLockOn();
                        if (remotePlayers[id].tech.isTargeting && remotePlayers[id].inputDown) {
                            const face = {
                                x: Math.cos(this.angle),
                                y: Math.sin(this.angle)
                            };
                            const target = Vector.normalise(Vector.sub(this.position, simulation.mouseInGame));
                            const dot = Vector.dot(target, face)
                            const aim = Math.min(0.08, (1 + dot) * 1)
                            if (Vector.cross(target, face) > 0) {
                                Matter.Body.rotate(this, aim);
                            } else {
                                Matter.Body.rotate(this, -aim);
                            }
                            this.frictionAir = Math.min(0.1, Math.max(0.04, 1 + dot)) //0.08; //extra friction if turning

                            //draw targeting square
                            ctx.strokeStyle = "#000"
                            ctx.lineWidth = 1
                            ctx.strokeRect(simulation.mouseInGame.x - 40, simulation.mouseInGame.y - 40, 80, 80)
                        } else if (this.lockedOn) { //rotate missile towards the target
                            const face = {
                                x: Math.cos(this.angle),
                                y: Math.sin(this.angle)
                            };
                            const target = Vector.normalise(Vector.sub(this.position, this.lockedOn.position));
                            const dot = Vector.dot(target, face)
                            const aim = Math.min(0.08, (1 + dot) * 1)
                            if (Vector.cross(target, face) > 0) {
                                Matter.Body.rotate(this, aim);
                            } else {
                                Matter.Body.rotate(this, -aim);
                            }
                            this.frictionAir = Math.min(0.1, Math.max(0.04, 1 + dot)) //0.08; //extra friction if turning
                        }
                        //accelerate in direction bullet is facing
                        const dir = this.angle;
                        this.force.x += thrust * Math.cos(dir);
                        this.force.y += thrust * Math.sin(dir);

                        ctx.beginPath(); //draw rocket
                        ctx.arc(this.position.x - Math.cos(this.angle) * (25 * size - 3) + (Math.random() - 0.5) * 4,
                            this.position.y - Math.sin(this.angle) * (25 * size - 3) + (Math.random() - 0.5) * 4,
                            11 * size, 0, 2 * Math.PI);
                        ctx.fillStyle = "rgba(255,155,0,0.5)";
                        ctx.fill();
                    }
                },
            });
            const thrust = 0.0066 * bullet[me].mass * (remotePlayers[id].tech.isMissileBig ? (remotePlayers[id].tech.isMissileBiggest ? 0.3 : 0.7) : 1);
            Matter.Body.setVelocity(bullet[me], {
                x: 0.5 * remotePlayers[id].velocity.x + speed * Math.cos(angle),
                y: 0.5 * remotePlayers[id].velocity.y + speed * Math.sin(angle)
            });
            Composite.add(engine.world, bullet[me]); bullet[me].remoteBullet = true; bullet[me].collisionFilter.group = -id;
            if (remotePlayers[id].tech.isMissileFast) {
                simulation.ephemera.push({
                    name: Math.random(),
                    count: 40, //cycles before it self removes
                    who: bullet[me],
                    do() {
                        if (!remotePlayers[id].isTimeDilated) {
                            const mag = 0.07 * this.who.mass
                            this.count--
                            if (this.count < 0 || !this.who) {
                                simulation.removeEphemera(this)
                            } else if (this.count < 3) {
                                if (this.count === 2) this.who.tryToLockOn();
                                if (this.who.lockedOn) {
                                    const unit = Vector.normalise(Vector.sub(this.who.lockedOn.position, this.who.position))

                                    const push = Vector.mult(unit, mag)
                                    this.who.force.x += push.x
                                    this.who.force.y += push.y
                                } else {
                                    const unit = {
                                        x: Math.cos(this.who.angle),
                                        y: Math.sin(this.who.angle)
                                    }
                                    const push = Vector.mult(unit, mag)
                                    this.who.force.x += push.x
                                    this.who.force.y += push.y
                                }
                            } else {
                                Matter.Body.setVelocity(this.who, { x: this.who.velocity.x * 0.7, y: this.who.velocity.y * 0.7 });
                            }
                        }
                    },
                })
            }
        }
        window.b2.spore = (where, velocity = null, id) => { //used with the tech upgrade in mob.death()
            const bIndex = bullet.length;
            const size = 4
            if (bIndex < 500 && remotePlayers[id]) { //can't make over 500 spores
                bullet[bIndex] = Bodies.polygon(where.x, where.y, size, size, {
                    // density: 0.0015,			//frictionAir: 0.01,
                    inertia: Infinity,
                    isFreeze: remotePlayers[id].tech.isSporeFreeze,
                    restitution: 0.5,
                    angle: Math.random() * 2 * Math.PI,
                    friction: 0,
                    frictionAir: 0.025,
                    thrust: (remotePlayers[id].tech.isSporeFollow ? 0.0011 : 0.0005) * (1 + 0.3 * (Math.random() - 0.5)),
                    dmg: (remotePlayers[id].tech.isMutualism ? 20 : 7), //bonus damage from remotePlayers[id].tech.isMutualism
                    lookFrequency: 100 + Math.floor(117 * Math.random()),
                    classType: "bullet",
                    isSpore: true,
                    collisionFilter: {
                        group: -id,
                        category: cat.body,
                        mask: cat.map | cat.mob | cat.mobBullet | cat.mobShield | cat.player //no collide with body
                    },
                    endCycle: simulation.cycle + Math.floor((540 + Math.floor(Math.random() * 420)) * remotePlayers[id].tech.bulletsLastLonger),
                    minDmgSpeed: 0,
                    playerOffPosition: { //used when moving towards remotePlayers[id] to keep spores separate
                        x: 100 * (Math.random() - 0.5),
                        y: 100 * (Math.random() - 0.5)
                    },
                    beforeDmg(who) {
                        if (!who.isInvulnerable) {
                            this.endCycle = 0; //bullet ends cycle after doing damage 
                            if (this.isFreeze) mobs.statusSlow(who, 90)
                        }
                    },
                    onEnd() {
                        if(this.lockedOn == player) {
                            simulation.drawList.push({ //add dmg to draw queue
                                x: this.position.x,
                                y: this.position.y,
                                radius: 25 * Math.random() + 10,
                                color: simulation.playerDmgColor,
                                time: simulation.drawTime
                            });
                        }
                    },
                    do() {
                        if (this.lockedOn && this.lockedOn.alive) {
                            this.force = Vector.mult(Vector.normalise(Vector.sub(this.lockedOn.position, this.position)), this.mass * this.thrust)
                            if(Matter.Query.collides(this, [player]).length && this.lockedOn == player) {
                                this.endCycle = 0;
                            }
                        } else {
                            if (!(simulation.cycle % this.lookFrequency)) { //find mob targets
                                this.closestTarget = null;
                                this.lockedOn = null;
                                let closeDist = Infinity;
                                let candidate = [...mob, player];
                                for (let i = 0, len = candidate.length; i < len; ++i) {
                                    if (!candidate[i].isBadTarget && Matter.Query.ray(map, this.position, candidate[i].position).length === 0 && !candidate[i].isInvulnerable && candidate[i].id != id) {
                                        const targetVector = Vector.sub(this.position, candidate[i].position)
                                        const dist = Vector.magnitude(targetVector) * (Math.random() + 0.5);
                                        if (dist < closeDist) {
                                            this.closestTarget = candidate[i].position;
                                            closeDist = dist;
                                            this.lockedOn = candidate[i];
                                            if(candidate[i] == player) {
                                                candidate[i].alive = m.alive;
                                            }
                                            if (0.3 > Math.random()) break //doesn't always target the closest mob
                                        }
                                    }
                                }
                            }
                            if (remotePlayers[id].tech.isSporeFollow && this.lockedOn === null) { //move towards remotePlayers[id]
                                //checking for null means that the spores don't go after the remotePlayers[id] until it has looked and not found a target
                                const dx = this.position.x - remotePlayers[id].pos.x;
                                const dy = this.position.y - remotePlayers[id].pos.y;
                                if (dx * dx + dy * dy > 10000) {
                                    this.force = Vector.mult(Vector.normalise(Vector.sub(remotePlayers[id].pos, Vector.add(this.playerOffPosition, this.position))), this.mass * this.thrust)
                                }
                            } else {
                                this.force.y += this.mass * 0.0001; //gravity
                            }

                        }
                    },
                });
                if (velocity) {
                    Matter.Body.setVelocity(bullet[bIndex], velocity);
                } else {
                    const SPEED = 4 + 8 * Math.random();
                    const ANGLE = 2 * Math.PI * Math.random()
                    Matter.Body.setVelocity(bullet[bIndex], {
                        x: SPEED * Math.cos(ANGLE),
                        y: SPEED * Math.sin(ANGLE)
                    });
                }
                Composite.add(engine.world, bullet[bIndex]); bullet[bIndex].remoteBullet = true;
            }
        };
        window.b2.pulse = (charge, angle, where, id) => {
            let best;
            let explosionRadius = 5.5 * charge
            let range = 5000
            const path = [{
                x: where.x + 20 * Math.cos(angle),
                y: where.y + 20 * Math.sin(angle)
            },
            {
                x: where.x + range * Math.cos(angle),
                y: where.y + range * Math.sin(angle)
            }
            ];
            best = {
                x: null,
                y: null,
                dist2: Infinity,
                who: null,
                v1: null,
                v2: null
            };
            const mobf = mob.filter(b => b.collisionFilter.group !== -id);
            if (!best.who) {
                best = vertexCollision(path[0], path[1], [mobf, map, body, [player]]);
                if (best.dist2 != Infinity) { //if hitting something
                    path[path.length - 1] = {
                        x: best.x,
                        y: best.y
                    };
                }
            }
            if (best.who) {
                b.explosion(path[1], explosionRadius)
                const off = explosionRadius * 1.2
                b.explosion({
                    x: path[1].x + off * (Math.random() - 0.5),
                    y: path[1].y + off * (Math.random() - 0.5)
                }, explosionRadius)
                b.explosion({
                    x: path[1].x + off * (Math.random() - 0.5),
                    y: path[1].y + off * (Math.random() - 0.5)
                }, explosionRadius)
            }
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            ctx.lineTo(path[1].x, path[1].y);
            if (charge > 50) {
                ctx.strokeStyle = "rgba(255,0,0,0.10)"
                ctx.lineWidth = 70
                ctx.stroke();
            }
            ctx.strokeStyle = "rgba(255,0,0,0.25)"
            ctx.lineWidth = 20
            ctx.stroke();
            ctx.strokeStyle = "#f00";
            ctx.lineWidth = 4
            ctx.stroke();

            const sub = Vector.sub(path[1], path[0])
            const mag = Vector.magnitude(sub)
            for (let i = 0, len = Math.floor(mag * 0.0005 * charge); i < len; i++) {
                const dist = Math.random()
                simulation.drawList.push({
                    x: path[0].x + sub.x * dist + 10 * (Math.random() - 0.5),
                    y: path[0].y + sub.y * dist + 10 * (Math.random() - 0.5),
                    radius: 1.5 + 5 * Math.random(),
                    color: "rgba(255,0,0,0.5)",
                    time: Math.floor(9 + 25 * Math.random() * Math.random())
                });
            }
        }
        window.b2.laser = (where, whereEnd, damage, reflections, isThickBeam, push, id) => {
            const reflectivity = 1 - 1 / (reflections * 3)
            let best = { x: 1, y: 1, dist2: Infinity, who: null, v1: 1, v2: 1 };
            const path = [{ x: where.x, y: where.y }, { x: whereEnd.x, y: whereEnd.y }];

            const checkForCollisions = function () {
                const validMobs = mob.filter(m => m.id !== id);
                best = vertexCollision(path[path.length - 2], path[path.length - 1], [validMobs, map, body, [player]]);
            };
            const laserHitMob = function () {
                if (best.who.alive) {
                    if(typeof best.who.locatePlayer == "function") best.who.locatePlayer();
                    if (best.who.damageReduction) {
                        if ( //iridescence
                            remotePlayers[id].tech.laserCrit && !best.who.shield &&
                            Vector.dot(Vector.normalise(Vector.sub(best.who.position, path[path.length - 1])), Vector.normalise(Vector.sub(path[path.length - 1], path[path.length - 2]))) > 0.999 - 0.5 / best.who.radius
                        ) {
                            damage *= 1 + remotePlayers[id].tech.laserCrit
                            simulation.drawList.push({ //add dmg to draw queue
                                x: path[path.length - 1].x,
                                y: path[path.length - 1].y,
                                radius: Math.sqrt(2500 * damage * best.who.damageReduction) + 5,
                                color: `hsla(${60 + 283 * Math.random()},100%,70%,0.5)`, // random hue, but not red
                                time: 16
                            });
                        } else {
                            simulation.drawList.push({ //add dmg to draw queue
                                x: path[path.length - 1].x,
                                y: path[path.length - 1].y,
                                radius: Math.sqrt(2000 * damage * best.who.damageReduction) + 2,
                                color: remotePlayers[id].tech.laserColorAlpha,
                                time: simulation.drawTime
                            });
                        }
                        best.who.damage(damage);
                    }
                    if (remotePlayers[id].tech.isLaserPush) { //push mobs away
                        const index = path.length - 1
                        Matter.Body.setVelocity(best.who, { x: best.who.velocity.x * 0.97, y: best.who.velocity.y * 0.97 });
                        const force = Vector.mult(Vector.normalise(Vector.sub(path[index], path[Math.max(0, index - 1)])), 0.003 * push * Math.min(6, best.who.mass))
                        Matter.Body.applyForce(best.who, path[index], force)
                    }
                } else if (remotePlayers[id].tech.isLaserPush && best.who.classType === "body") {
                    const index = path.length - 1
                    Matter.Body.setVelocity(best.who, { x: best.who.velocity.x * 0.97, y: best.who.velocity.y * 0.97 });
                    const force = Vector.mult(Vector.normalise(Vector.sub(path[index], path[Math.max(0, index - 1)])), 0.003 * push * Math.min(6, best.who.mass))
                    Matter.Body.applyForce(best.who, path[index], force)
                }
                if(best.who.collisionFilter.category == 1) {
                    if (remotePlayers[id].tech.isLaserPush) { //push mobs away
                        const index = path.length - 1
                        Matter.Body.setVelocity(best.who, { x: best.who.velocity.x * 0.97, y: best.who.velocity.y * 0.97 });
                        const force = Vector.mult(Vector.normalise(Vector.sub(path[index], path[Math.max(0, index - 1)])), 0.003 * push * Math.min(6, best.who.mass))
                        Matter.Body.applyForce(best.who, path[index], force)
                    }
                    if ( //iridescence
                        remotePlayers[id].tech.laserCrit &&
                        Vector.dot(Vector.normalise(Vector.sub(best.who.position, path[path.length - 1])), Vector.normalise(Vector.sub(path[path.length - 1], path[path.length - 2]))) > 0.999 - 0.5 / best.who.radius
                    ) {
                        damage *= 1 + remotePlayers[id].tech.laserCrit
                        simulation.drawList.push({ //add dmg to draw queue
                            x: path[path.length - 1].x,
                            y: path[path.length - 1].y,
                            radius: Math.sqrt(2500 * damage) + 5,
                            color: `hsla(${60 + 283 * Math.random()},100%,70%,0.5)`, // random hue, but not red
                            time: 16
                        });
                    } else {
                        simulation.drawList.push({ //add dmg to draw queue
                            x: path[path.length - 1].x,
                            y: path[path.length - 1].y,
                            radius: Math.sqrt(2000 * damage) + 2,
                            color: remotePlayers[id].tech.laserColorAlpha,
                            time: simulation.drawTime
                        });
                    }
                }
            };
            const reflection = function () { // https://math.stackexchange.com/questions/13261/how-to-get-a-reflection-vector
                const n = Vector.perp(Vector.normalise(Vector.sub(best.v1, best.v2)));
                const d = Vector.sub(path[path.length - 1], path[path.length - 2]);
                const nn = Vector.mult(n, 2 * Vector.dot(d, n));
                const r = Vector.normalise(Vector.sub(d, nn));
                path[path.length] = Vector.add(Vector.mult(r, 5000), path[path.length - 1]);
            };

            checkForCollisions();
            let lastBestOdd
            let lastBestEven = best.who //used in hack below
            if (best.dist2 !== Infinity) { //if hitting something
                path[path.length - 1] = { x: best.x, y: best.y };
                laserHitMob();
                for (let i = 0; i < reflections; i++) {
                    reflection();
                    checkForCollisions();
                    if (best.dist2 !== Infinity) { //if hitting something
                        lastReflection = best
                        path[path.length - 1] = { x: best.x, y: best.y };
                        damage *= reflectivity
                        laserHitMob();
                        //I'm not clear on how this works, but it gets rid of a bug where the laser reflects inside a block, often vertically.
                        //I think it checks to see if the laser is reflecting off a different part of the same block, if it is "inside" a block
                        if (i % 2) {
                            if (lastBestOdd === best.who) break
                        } else {
                            lastBestOdd = best.who
                            if (lastBestEven === best.who) break
                        }
                    } else {
                        break
                    }
                }
            }
            if (isThickBeam) {
                for (let i = 1, len = path.length; i < len; ++i) {
                    ctx.moveTo(path[i - 1].x, path[i - 1].y);
                    ctx.lineTo(path[i].x, path[i].y);
                }
            } else if (remotePlayers[id].tech.isLaserLens && remotePlayers[id].lensDamage !== 1) {
                ctx.strokeStyle = remotePlayers[id].tech.laserColor;
                ctx.lineWidth = 2
                ctx.lineDashOffset = 900 * Math.random()
                ctx.setLineDash([50 + 120 * Math.random(), 50 * Math.random()]);
                for (let i = 1, len = path.length; i < len; ++i) {
                    ctx.beginPath();
                    ctx.moveTo(path[i - 1].x, path[i - 1].y);
                    ctx.lineTo(path[i].x, path[i].y);
                    ctx.stroke();
                    ctx.globalAlpha *= reflectivity; //reflections are less intense
                }
                ctx.setLineDash([]);
                // ctx.globalAlpha = 1;

                //glow
                ctx.lineWidth = 9 + 2 * remotePlayers[id].lensDamageOn
                ctx.globalAlpha = 0.13
                ctx.beginPath();
                for (let i = 1, len = path.length; i < len; ++i) {
                    ctx.moveTo(path[i - 1].x, path[i - 1].y);
                    ctx.lineTo(path[i].x, path[i].y);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            } else {
                ctx.strokeStyle = remotePlayers[id].tech.laserColor;
                ctx.lineWidth = 2
                ctx.lineDashOffset = 900 * Math.random()
                ctx.setLineDash([50 + 120 * Math.random(), 50 * Math.random()]);
                for (let i = 1, len = path.length; i < len; ++i) {
                    ctx.beginPath();
                    ctx.moveTo(path[i - 1].x, path[i - 1].y);
                    ctx.lineTo(path[i].x, path[i].y);
                    ctx.stroke();
                    ctx.globalAlpha *= reflectivity; //reflections are less intense
                }
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }
        }
        window.b2.delayDrones = (where, droneCount = 1, deliveryCount = 0, id) => {
            let respawnDrones = () => {
                if (droneCount > 0) {
                    requestAnimationFrame(respawnDrones);
                    if (!simulation.paused && !simulation.isChoosing && m.alive) {
                        droneCount--
                        if (tech.isDroneRadioactive) {
                            b2.droneRadioactive({ x: where.x + 50 * (Math.random() - 0.5), y: where.y + 50 * (Math.random() - 0.5) }, 0, id)
                        } else {
                            b2.drone({ x: where.x + 50 * (Math.random() - 0.5), y: where.y + 50 * (Math.random() - 0.5) }, 0, id)
                            if (tech.isDroneGrab && deliveryCount > 0) { //
                                const who = bullet[bullet.length - 1]
                                who.isImproved = true;
                                const SCALE = 2.25
                                who.scale = SCALE
                                Matter.Body.scale(who, SCALE, SCALE);
                                who.endCycle += 3000 * tech.droneCycleReduction * tech.bulletsLastLonger
                                deliveryCount--
                            }
                        }
                    }
                }
            }
            requestAnimationFrame(respawnDrones);
        }
        window.b2.drone = (where, speed, id) => {
            const em = bullet.length;
            const THRUST = 0.0015
            const dir = remotePlayers[id].angle2 + 0.2 * (Math.random() - 0.5);
            const RADIUS = (4.5 + 3 * Math.random())
            bullet[em] = Bodies.polygon(where.x, where.y, 8, RADIUS, {
                angle: dir,
                inertia: Infinity,
                friction: 0.05,
                frictionAir: 0,
                restitution: 1,
                density: 0.0005, //  0.001 is normal density
                dmg: 0.34 + 0.12 * remotePlayers[id].tech.isDroneTeleport + 0.15 * remotePlayers[id].tech.isDroneFastLook, //damage done in addition to the damage from momentum
                lookFrequency: 55 + Math.floor(10 * Math.random()),
                endCycle: simulation.cycle + Math.floor((900 + 400 * Math.random()) * remotePlayers[id].tech.bulletsLastLonger * remotePlayers[id].tech.droneCycleReduction) + 5 * RADIUS + Math.max(0, 200 - bullet.length),
                classType: "bullet",
                isDrone: true,
                collisionFilter: {
                    group: -id,
                    category: cat.body,
                    mask: cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet | cat.mobShield | cat.player //self collide
                },
                minDmgSpeed: 0,
                lockedOn: null,
                deathCycles: 110 + RADIUS * 5,
                isImproved: false,
                scale: 1,
                beforeDmg(who) {
                    if (who.isInvulnerable) {
                        //move away from target after hitting
                        const unit = Vector.mult(Vector.normalise(Vector.sub(this.position, who.position)), -20)
                        Matter.Body.setVelocity(this, { x: unit.x, y: unit.y });
                        this.lockedOn = null
                    } else {
                        //move away from target after hitting
                        const unit = Vector.mult(Vector.normalise(Vector.sub(this.position, who.position)), -20)
                        Matter.Body.setVelocity(this, { x: unit.x, y: unit.y });
                        this.lockedOn = null
                        if (this.endCycle > simulation.cycle + this.deathCycles) {
                            this.endCycle -= 50 + this.scale * 30
                            if (simulation.cycle + this.deathCycles > this.endCycle) this.endCycle = simulation.cycle + this.deathCycles
                        }
                    }
                },
                onEnd() {
                    if (!remotePlayers[id]) return;
                    if (remotePlayers[id].tech.isDroneRespawn) {
                        //are there any nearby bodies nearby that aren't blocked by map?
                        const canSee = body.filter(a => Matter.Query.ray(map, this.position, a.position).length === 0 && !a.isNotHoldable && Vector.magnitude(Vector.sub(this.position, a.position)) < 70 + 30 * a.mass)
                        if (canSee.length) {
                            //find the closest body to the drone from the canSee array
                            const found = canSee.reduce((a, b) => {
                                const distA = Vector.magnitude(Vector.sub(this.position, a.position))
                                const distB = Vector.magnitude(Vector.sub(this.position, b.position))
                                return distA < distB ? a : b
                            })
                            if (found && remotePlayers[id].energy > 0.041) {
                                remotePlayers[id].energy -= 0.04
                                //remotePlayers[id].fieldUpgrades[4].endoThermic(0.4)
                                //remove the body and spawn a new drone
                                Composite.remove(engine.world, found)
                                body.splice(body.indexOf(found), 1)
                                b2.delayDrones(found.position, Math.sqrt(found.mass), id)
                                //draw a line from the drone to the body on the canvas
                                ctx.beginPath();
                                ctx.moveTo(this.position.x, this.position.y);
                                ctx.lineTo(found.position.x, found.position.y);
                                ctx.strokeStyle = "#000";
                                ctx.lineWidth = 2;
                                ctx.stroke();

                                //animate the block fading away
                                simulation.ephemera.push({
                                    count: 60, //cycles before it self removes
                                    do() {
                                        this.count--
                                        if (this.count < 0) simulation.removeEphemera(this)
                                        ctx.beginPath();
                                        let vertices = found.vertices;
                                        ctx.moveTo(vertices[0].x, vertices[0].y);
                                        for (let j = 1; j < vertices.length; j++) ctx.lineTo(vertices[j].x, vertices[j].y);
                                        ctx.lineTo(vertices[0].x, vertices[0].y);
                                        ctx.lineWidth = 2;
                                        ctx.strokeStyle = `rgba(0,0,0,${this.count / 60})`
                                        ctx.stroke();
                                    },
                                })
                            }
                        }
                    }
                },
                doRespawning() { //fall shrink and die
                    const scale = 0.995;
                    Matter.Body.scale(this, scale, scale);
                    if (this.bodyTarget) {
                        this.force = Vector.mult(Vector.normalise(Vector.sub(this.position, this.bodyTarget.position)), -this.mass * THRUST)
                    } else {
                        this.force.y += this.mass * 0.0012;
                    }
                },
                doDying() { //fall shrink and die
                    this.force.y += this.mass * 0.0012;
                    const scale = 0.995;
                    Matter.Body.scale(this, scale, scale);
                },
                hasExploded: false,
                eatPowerUp(i) {
                    simulation.ephemera.push({
                        count: 5, //cycles before it self removes
                        pos: this.position,
                        PposX: powerUp[i].position.x,
                        PposY: powerUp[i].position.y,
                        size: powerUp[i].size,
                        color: powerUp[i].color,
                        do() {
                            this.count--
                            if (this.count < 0) simulation.removeEphemera(this)
                            ctx.strokeStyle = "#000"
                            ctx.lineWidth = 3
                            ctx.beginPath();
                            ctx.moveTo(this.pos.x, this.pos.y);
                            ctx.lineTo(this.PposX, this.PposY);
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.arc(this.PposX, this.PposY, this.size * (this.count + 2) / 7, 0, 2 * Math.PI);
                            ctx.fillStyle = this.color
                            ctx.fill();
                        },
                    })
                    //pick up nearby power ups
                    powerUps.onPickUp(powerUp[i]);
                    // powerUp[i].effect();
                    Matter.Composite.remove(engine.world, powerUp[i]);
                    powerUp.splice(i, 1);
                    if (remotePlayers[id].tech.isDroneGrab) {
                        this.isImproved = true;
                        if (this.scale > 1) Matter.Body.scale(this, 1 / this.scale, 1 / this.scale);
                        const SCALE = 2.25
                        this.scale = SCALE
                        Matter.Body.scale(this, SCALE, SCALE);
                        this.endCycle += 3000 * remotePlayers[id].tech.droneCycleReduction * remotePlayers[id].tech.bulletsLastLonger
                    }
                },
                do() {
                    if (!remotePlayers[id]) return;
                    if (simulation.cycle + this.deathCycles > this.endCycle) {
                        if (remotePlayers[id].tech.isIncendiary && !this.hasExploded) {
                            this.hasExploded = true
                            // const max = Math.max(Math.min(this.endCycle - simulation.cycle - this.deathCycles, 1500), 0)
                            // this.endCycle -= max
                            b.explosion(this.position, 200 + this.isImproved * 110 + 60 * Math.random()); //makes bullet do explosive damage at end
                        }
                        this.restitution = 0.2;
                        if (remotePlayers[id].tech.isDroneRespawn) {
                            this.do = this.doRespawning
                            //make a list of all elements of array body that a ray can be drawn to from the drone                        
                            const canSee = body.filter(a => Matter.Query.ray(map, this.position, a.position).length === 0 && !a.isNotHoldable)
                            if (canSee.length) {
                                //find the closest body to the drone from the canSee array
                                const found = canSee.reduce((a, b) => {
                                    const distA = Vector.magnitude(Vector.sub(this.position, a.position))
                                    const distB = Vector.magnitude(Vector.sub(this.position, b.position))
                                    return distA < distB ? a : b
                                })
                                if (found) this.bodyTarget = found
                            }
                        } else {
                            this.do = this.doDying
                        }
                    }

                    this.force.y += this.mass * 0.0002;
                    if(this.lockedOn == player) {
                        if(Matter.Query.collides(this, [player]).length) {
                            const unit = Vector.mult(Vector.normalise(Vector.sub(this.position, player.position)), -20)
                            Matter.Body.setVelocity(this, { x: unit.x, y: unit.y });
                            this.lockedOn = null
                            if (this.endCycle > simulation.cycle + this.deathCycles) {
                                this.endCycle -= 50 + this.scale * 30
                                if (simulation.cycle + this.deathCycles > this.endCycle) this.endCycle = simulation.cycle + this.deathCycles
                            }
                        }
                    }
                    if (!(simulation.cycle % this.lookFrequency)) {
                        if (remotePlayers[id].tech.isExponential) { //base drones last about 22 seconds
                            if (Matter.Query.collides(this, map).length > 1) {
                                const SCALE = 0.9
                                Matter.Body.scale(this, SCALE, SCALE);
                                this.scale *= SCALE
                            } else {
                                const SCALE = 1.03
                                Matter.Body.scale(this, SCALE, SCALE);
                                this.scale *= SCALE
                            }
                        }
                        //find mob targets
                        this.lockedOn = null;
                        let closeDist = Infinity;
                        for (let i = 0, len = mob.length; i < len; ++i) {
                            if (
                                !mob[i].isBadTarget &&
                                Matter.Query.ray(map, this.position, mob[i].position).length === 0 &&
                                Matter.Query.ray(body, this.position, mob[i].position).length === 0 &&
                                !mob[i].isInvulnerable && mob[i].id != id
                            ) {
                                const TARGET_VECTOR = Vector.sub(this.position, mob[i].position)
                                const DIST = Vector.magnitude(TARGET_VECTOR)
                                if (DIST < closeDist) {
                                    closeDist = DIST;
                                    this.lockedOn = mob[i]
                                }
                            }
                        }
                        if(Matter.Query.ray(map, this.position, player.position).length === 0 && Matter.Query.ray(body, this.position, player.position).length === 0) {
                            const TARGET_VECTOR = Vector.sub(this.position, player.position)
                            const DIST = Vector.magnitude(TARGET_VECTOR)
                            if (DIST < closeDist) {
                                closeDist = DIST;
                                this.lockedOn = player
                            }
                        }
                        //blink towards mobs
                        if (remotePlayers[id].tech.isDroneTeleport && this.lockedOn) {
                            const sub = Vector.sub(this.lockedOn.position, this.position);
                            const distMag = Vector.magnitude(sub);
                            const unit = Vector.normalise(sub)
                            Matter.Body.setVelocity(this, Vector.mult(unit, Math.max(20, this.speed * 1.5)));
                            ctx.beginPath();
                            ctx.moveTo(this.position.x, this.position.y);
                            Matter.Body.translate(this, Vector.mult(unit, Math.min(350, distMag - this.lockedOn.radius + 10)));
                            ctx.lineTo(this.position.x, this.position.y);
                            ctx.lineWidth = RADIUS * 2;
                            ctx.strokeStyle = "rgba(0,0,0,0.5)";
                            ctx.stroke();
                        }
                        //power ups
                        if (!this.isImproved && !simulation.isChoosing) {
                            if (this.lockedOn) {
                                for (let i = 0, len = powerUp.length; i < len; ++i) { //grab, but don't lock onto nearby power up
                                    if (
                                        Vector.magnitudeSquared(Vector.sub(this.position, powerUp[i].position)) < 20000
                                        && !simulation.isChoosing
                                        && !(
                                            (remotePlayers[id].health > 0.94 * remotePlayers[id].maxHealth && !remotePlayers[id].tech.isOverHeal && !remotePlayers[id].tech.isDroneGrab && powerUp[i].name === "heal") ||
                                            (remotePlayers[id].tech.isSuperDeterminism && powerUp[i].name === "field") ||
                                            ((remotePlayers[id].tech.isEnergyNoAmmo || b.inventory.length === 0) && powerUp[i].name === "ammo")
                                        )
                                    ) {
                                        this.eatPowerUp(i)
                                        break;
                                    }
                                }
                            } else {
                                //look for power ups to lock onto
                                let closeDist = Infinity;
                                for (let i = 0, len = powerUp.length; i < len; ++i) {
                                    if (!(
                                        (remotePlayers[id].health > 0.94 * remotePlayers[id].maxHealth && !remotePlayers[id].tech.isOverHeal && !remotePlayers[id].tech.isDroneGrab && powerUp[i].name === "heal") ||
                                        (remotePlayers[id].tech.isSuperDeterminism && powerUp[i].name === "field") ||
                                        ((remotePlayers[id].tech.isEnergyNoAmmo || b.inventory.length === 0) && powerUp[i].name === "ammo")
                                    )) {
                                        if (Vector.magnitudeSquared(Vector.sub(this.position, powerUp[i].position)) < 20000 && !simulation.isChoosing) {
                                            this.eatPowerUp(i)
                                            break;
                                        }
                                        //look for power ups to lock onto
                                        if (
                                            Matter.Query.ray(map, this.position, powerUp[i].position).length === 0 //&& Matter.Query.ray(body, this.position, powerUp[i].position).length === 0
                                        ) {
                                            const TARGET_VECTOR = Vector.sub(this.position, powerUp[i].position)
                                            const DIST = Vector.magnitude(TARGET_VECTOR);
                                            if (DIST < closeDist) {
                                                closeDist = DIST;
                                                this.lockedOn = powerUp[i]
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (this.lockedOn) { //accelerate towards mobs
                        this.force = Vector.mult(Vector.normalise(Vector.sub(this.position, this.lockedOn.position)), -this.mass * THRUST)
                    } else { //accelerate towards mouse
                        this.force = Vector.mult(Vector.normalise(Vector.sub(this.position, remotePlayers[id].mouse)), -this.mass * THRUST)
                    }
                    // speed cap instead of friction to give more agility
                    if (this.speed > 6) {
                        Matter.Body.setVelocity(this, { x: this.velocity.x * 0.97, y: this.velocity.y * 0.97 });
                    }
                }
            })
            Composite.add(engine.world, bullet[em]); //add bullet to world
            Matter.Body.setVelocity(bullet[em], { x: speed * Math.cos(dir), y: speed * Math.sin(dir) });
        }
        window.b2.droneRadioactive = (where, speed, id) => {
            const em = bullet.length;
            const THRUST = (remotePlayers[id].tech.isFastDrones ? 0.003 : 0.0012) + 0.0005 * (Math.random() - 0.5)
            const dir = remotePlayers[id].angle2 + 0.4 * (Math.random() - 0.5);
            const RADIUS = 3
            bullet[em] = Bodies.polygon(where.x, where.y, 8, RADIUS, {
                angle: dir,
                inertia: Infinity,
                friction: 0,
                frictionAir: 0,
                restitution: 0.4 + 0.199 * Math.random(),
                dmg: 0, //0.24   damage done in addition to the damage from momentum   and radiation
                lookFrequency: 120 + Math.floor(23 * Math.random()),
                endCycle: simulation.cycle + Math.floor((850 + 110 * Math.random()) * remotePlayers[id].tech.bulletsLastLonger / remotePlayers[id].tech.droneRadioDamage) + 5 * RADIUS + Math.max(0, 200 - 2 * bullet.length),
                classType: "bullet",
                isDrone: true,
                collisionFilter: {
                    category: cat.bullet,
                    mask: cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet | cat.mobShield //self collide
                },
                minDmgSpeed: 0,
                speedCap: 5 + 2 * Math.random(), //6 is normal
                lockedOn: null,
                deathCycles: 110 + RADIUS * 5,
                isImproved: false,
                radioRadius: 0,
                maxRadioRadius: 270 + Math.floor(90 * Math.random()),
                beforeDmg() { },
                onEnd() {
                    if (!remotePlayers[id]) return;
                    if (remotePlayers[id].tech.isDroneRespawn) {
                        //are there any nearby bodies nearby that aren't blocked by map?
                        const canSee = body.filter(a => Matter.Query.ray(map, this.position, a.position).length === 0 && !a.isNotHoldable && Vector.magnitude(Vector.sub(this.position, a.position)) < 70 + 30 * a.mass)
                        if (canSee.length) {
                            //find the closest body to the drone from the canSee array
                            const found = canSee.reduce((a, b) => {
                                const distA = Vector.magnitude(Vector.sub(this.position, a.position))
                                const distB = Vector.magnitude(Vector.sub(this.position, b.position))
                                return distA < distB ? a : b
                            })
                            if (found && remotePlayers[id].energy > 0.091) {
                                remotePlayers[id].energy -= 0.09
                                remotePlayers[id].fieldUpgrades[4].endoThermic(0.7)
                                //remove the body and spawn a new drone
                                Composite.remove(engine.world, found)
                                body.splice(body.indexOf(found), 1)
                                b2.delayDrones(found.position, 0.5 * Math.sqrt(found.mass), id)
                                //draw a line from the drone to the body on the canvas
                                ctx.beginPath();
                                ctx.moveTo(this.position.x, this.position.y);
                                ctx.lineTo(found.position.x, found.position.y);
                                ctx.strokeStyle = "#000";
                                ctx.lineWidth = 2;
                                ctx.stroke();

                                //animate the block fading away
                                simulation.ephemera.push({
                                    count: 60, //cycles before it self removes
                                    do() {
                                        this.count--
                                        if (this.count < 0) simulation.removeEphemera(this)
                                        ctx.beginPath();
                                        let vertices = found.vertices;
                                        ctx.moveTo(vertices[0].x, vertices[0].y);
                                        for (let j = 1; j < vertices.length; j++) {
                                            ctx.lineTo(vertices[j].x, vertices[j].y);
                                        }
                                        ctx.lineTo(vertices[0].x, vertices[0].y);
                                        ctx.lineWidth = 2;
                                        ctx.strokeStyle = `rgba(0,0,0,${this.count / 60})`
                                        ctx.stroke();
                                    },
                                })
                            }
                        }
                    }
                },
                do() {
                    //radioactive zone
                    if (!remotePlayers[id]) return;
                    this.radioRadius = this.radioRadius * 0.993 + 0.007 * this.maxRadioRadius //smooth radius towards max
                    //aoe damage to mobs
                    let dmg = (0.12 + 0.04 * remotePlayers[id].tech.isFastDrones) * remotePlayers[id].tech.droneRadioDamage * remotePlayers[id].tech.radioactiveDamage
                    for (let i = 0, len = mob.length; i < len; i++) {
                        if (Vector.magnitude(Vector.sub(mob[i].position, this.position)) < this.radioRadius + mob[i].radius && mob[i].id != id) {
                            if (Matter.Query.ray(map, mob[i].position, this.position).length > 0) dmg *= 0.25 //reduce damage if a wall is in the way
                            mob[i].damage(mob[i].shield ? dmg * 3 : dmg);
                            mob[i].locatePlayer();
                        }
                    }
                    //draw
                    ctx.beginPath();
                    ctx.arc(this.position.x, this.position.y, this.radioRadius, 0, 2 * Math.PI);
                    ctx.globalCompositeOperation = "lighter"
                    // ctx.fillStyle = `rgba(25,139,170,${0.15+0.05*Math.random()})`;
                    // ctx.fillStyle = `rgba(36, 207, 255,${0.1+0.05*Math.random()})`;
                    ctx.fillStyle = `rgba(28, 175, 217,${0.13 + 0.07 * Math.random()})`;
                    ctx.fill();
                    ctx.globalCompositeOperation = "source-over"

                    //normal drone actions
                    if (simulation.cycle + this.deathCycles > this.endCycle) { //fall shrink and die
                        this.force.y += this.mass * 0.0012;
                        this.restitution = 0.2;
                        const scale = 0.995;
                        Matter.Body.scale(this, scale, scale);
                        this.maxRadioRadius = 0
                        this.radioRadius = this.radioRadius * 0.98 //let radioactivity decrease
                    } else {
                        this.force.y += this.mass * 0.0002; //gravity

                        if (!(simulation.cycle % this.lookFrequency)) {
                            if (remotePlayers[id].tech.isExponential) { //base drones last about 22 seconds
                                const SCALE = 1.03
                                Matter.Body.scale(this, SCALE, SCALE);
                                this.scale *= SCALE
                                this.radioRadius = this.radioRadius * SCALE
                            }
                            //find mob targets
                            this.lockedOn = null;
                            let closeDist = Infinity;
                            for (let i = 0, len = mob.length; i < len; ++i) {
                                if (
                                    !mob[i].isBadTarget &&
                                    Matter.Query.ray(map, this.position, mob[i].position).length === 0 &&
                                    Matter.Query.ray(body, this.position, mob[i].position).length === 0 &&
                                    !mob[i].isInvulnerable && mob[i].id != id
                                ) {
                                    const TARGET_VECTOR = Vector.sub(this.position, mob[i].position)
                                    const DIST = Vector.magnitude(TARGET_VECTOR);
                                    if (DIST < closeDist) {
                                        closeDist = DIST;
                                        this.lockedOn = mob[i]
                                    }
                                }
                            }
                            if(Matter.Query.ray(map, this.position, player.position).length === 0 && Matter.Query.ray(body, this.position, player.position).length === 0) {
                                const TARGET_VECTOR = Vector.sub(this.position, player.position)
                                const DIST = Vector.magnitude(TARGET_VECTOR)
                                if (DIST < closeDist) {
                                    closeDist = DIST;
                                    this.lockedOn = player
                                }
                            }
                            //power ups
                            if (!this.isImproved && !simulation.isChoosing) {
                                if (this.lockedOn) {
                                    //grab, but don't lock onto nearby power up
                                    for (let i = 0, len = powerUp.length; i < len; ++i) {
                                        if (
                                            Vector.magnitudeSquared(Vector.sub(this.position, powerUp[i].position)) < 20000 &&
                                            !(
                                                (remotePlayers[id].health > 0.93 * remotePlayers[id].maxHealth && !remotePlayers[id].tech.isDroneGrab && powerUp[i].name === "heal") ||
                                                (remotePlayers[id].tech.isSuperDeterminism && powerUp[i].name === "field") ||
                                                ((remotePlayers[id].tech.isEnergyNoAmmo || b.inventory.length === 0) && powerUp[i].name === "ammo")
                                            )
                                        ) {
                                            //draw pickup for a single cycle
                                            ctx.beginPath();
                                            ctx.moveTo(this.position.x, this.position.y);
                                            ctx.lineTo(powerUp[i].position.x, powerUp[i].position.y);
                                            ctx.strokeStyle = "#000"
                                            ctx.lineWidth = 4
                                            ctx.stroke();
                                            //pick up nearby power ups
                                            powerUps.onPickUp(powerUp[i]);
                                            Matter.Composite.remove(engine.world, powerUp[i]);
                                            powerUp.splice(i, 1);
                                            if (remotePlayers[id].tech.isDroneGrab) {
                                                this.isImproved = true;
                                                const SCALE = 2.25
                                                if (this.scale > 1) Matter.Body.scale(this, 1 / this.scale, 1 / this.scale);
                                                this.scale = SCALE
                                                Matter.Body.scale(this, SCALE, SCALE);
                                                this.endCycle += 1000 * remotePlayers[id].tech.bulletsLastLonger
                                                this.maxRadioRadius *= 1.25
                                            }
                                            break;
                                        }
                                    }
                                } else {
                                    //look for power ups to lock onto
                                    let closeDist = Infinity;
                                    for (let i = 0, len = powerUp.length; i < len; ++i) {
                                        if (!(
                                            (remotePlayers[id].health > 0.93 * remotePlayers[id].maxHealth && !remotePlayers[id].tech.isDroneGrab && powerUp[i].name === "heal") ||
                                            (remotePlayers[id].tech.isSuperDeterminism && powerUp[i].name === "field") ||
                                            ((remotePlayers[id].tech.isEnergyNoAmmo || b.inventory.length === 0) && powerUp[i].name === "ammo")
                                        )) {
                                            if (Vector.magnitudeSquared(Vector.sub(this.position, powerUp[i].position)) < 20000 && !simulation.isChoosing) {
                                                //draw pickup for a single cycle
                                                ctx.beginPath();
                                                ctx.moveTo(this.position.x, this.position.y);
                                                ctx.lineTo(powerUp[i].position.x, powerUp[i].position.y);
                                                ctx.strokeStyle = "#000"
                                                ctx.lineWidth = 4
                                                ctx.stroke();
                                                //pick up nearby power ups
                                                powerUps.onPickUp(powerUp[i]);
                                                Matter.Composite.remove(engine.world, powerUp[i]);
                                                powerUp.splice(i, 1);
                                                if (remotePlayers[id].tech.isDroneGrab) {
                                                    this.isImproved = true;
                                                    const SCALE = 2.25
                                                    if (this.scale > 1) Matter.Body.scale(this, 1 / this.scale, 1 / this.scale);
                                                    this.scale = SCALE
                                                    Matter.Body.scale(this, SCALE, SCALE);
                                                    this.endCycle += 1000 * remotePlayers[id].tech.bulletsLastLonger
                                                    this.maxRadioRadius *= 1.25
                                                }
                                                break;
                                            }
                                            //look for power ups to lock onto
                                            if (
                                                Matter.Query.ray(map, this.position, powerUp[i].position).length === 0 &&
                                                Matter.Query.ray(body, this.position, powerUp[i].position).length === 0
                                            ) {
                                                const TARGET_VECTOR = Vector.sub(this.position, powerUp[i].position)
                                                const DIST = Vector.magnitude(TARGET_VECTOR);
                                                if (DIST < closeDist) {
                                                    closeDist = DIST;
                                                    this.lockedOn = powerUp[i]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (this.lockedOn) { //accelerate towards mobs
                            this.force = Vector.mult(Vector.normalise(Vector.sub(this.position, this.lockedOn.position)), -this.mass * THRUST)
                        } else { //accelerate towards mouse
                            this.force = Vector.mult(Vector.normalise(Vector.sub(this.position, remotePlayers[id].mouse)), -this.mass * THRUST)
                        }
                        // speed cap instead of friction to give more agility
                        if (this.speed > this.speedCap) {
                            Matter.Body.setVelocity(this, {
                                x: this.velocity.x * 0.97,
                                y: this.velocity.y * 0.97
                            });
                        }
                    }
                }
            })
            Composite.add(engine.world, bullet[em]); //add bullet to world
            Matter.Body.setVelocity(bullet[em], {
                x: speed * Math.cos(dir),
                y: speed * Math.sin(dir)
            });
        }
        window.b2.foam = (position, velocity, radius, id) => {
            if (remotePlayers[id].tech.isFoamCavitation && Math.random() < 0.25) {
                velocity = Vector.mult(velocity, 1.35)
                radius = 1.2 * radius + 13
            }
            // radius *= Math.sqrt(remotePlayers[id].tech.bulletSize)
            const me = bullet.length;
            bullet[me] = Bodies.polygon(position.x, position.y, 20, radius, {
                density: 0.000001, //  0.001 is normal density
                inertia: Infinity,
                frictionAir: 0.003,
                dmg: 0, //damage on impact
                damage: remotePlayers[id].tech.foamDamage * (remotePlayers[id].tech.isFastFoam ? 2.8 : 1) * (remotePlayers[id].tech.isBulletTeleport ? 1.53 : 1), //damage done over time
                scale: 1 - 0.006 / remotePlayers[id].tech.bulletsLastLonger * (remotePlayers[id].tech.isFastFoam ? 1.65 : 1),
                classType: "bullet",
                collisionFilter: {
                    category: cat.body,
                    mask: cat.mob | cat.mobBullet | cat.player // cat.map | cat.body | cat.mob | cat.mobShield
                },
                minDmgSpeed: 0,
                endCycle: Infinity,
                count: 0,
                radius: radius,
                target: null,
                targetVertex: null,
                targetRelativePosition: null,
                portFrequency: 7 + Math.floor(5 * Math.random()),
                nextPortCycle: Infinity, //disabled unless you have the teleport tech
                beforeDmg(who) {
                    if (!this.target && who.alive) {
                        this.target = who;
                        if (who.radius < 20) {
                            this.targetRelativePosition = {
                                x: 0,
                                y: 0
                            } //find relative position vector for zero mob rotation
                        } else if (Matter.Query.collides(this, [who]).length > 0) {
                            const normal = Matter.Query.collides(this, [who])[0].normal
                            this.targetRelativePosition = Vector.rotate(Vector.sub(Vector.sub(this.position, who.position), Vector.mult(normal, -this.radius)), -who.angle) //find relative position vector for zero mob rotation
                        } else {
                            this.targetRelativePosition = Vector.rotate(Vector.sub(this.position, who.position), -who.angle) //find relative position vector for zero mob rotation
                        }
                        this.collisionFilter.category = cat.body;
                        this.collisionFilter.mask = null;

                        let bestVertexDistance = Infinity
                        let bestVertex = null
                        for (let i = 0; i < this.target.vertices.length; i++) {
                            const dist = Vector.magnitude(Vector.sub(this.position, this.target.vertices[i]));
                            if (dist < bestVertexDistance) {
                                bestVertex = i
                                bestVertexDistance = dist
                            }
                        }
                        this.targetVertex = bestVertex
                        Matter.Body.setVelocity(this, { x: 0, y: 0 });
                    }
                },
                onEnd() { },
                do() {
                    if(!remotePlayers[id]) return;
                    if (this.count < 20) {
                        this.count++
                        //grow
                        const SCALE = 1.06
                        Matter.Body.scale(this, SCALE, SCALE);
                        this.radius *= SCALE;
                    } else {
                        //shrink
                        Matter.Body.scale(this, this.scale, this.scale);
                        this.radius *= this.scale;
                        if (this.radius < 8) this.endCycle = 0;
                    }
                    if (this.target == player) {
                        const rotate = Vector.rotate(this.targetRelativePosition, m.angle)
                        Matter.Body.setPosition(this, Vector.add(Vector.add(rotate, this.target.velocity), this.target.position))
                        if (player.speed > 2.5) {
                            Matter.Body.setVelocity(player, Vector.mult(player.velocity, 0.94))
                        }
                    } else if (this.target && this.target.alive && this.target.mob) {
                        const rotate = Vector.rotate(this.targetRelativePosition, this.target.angle) //add in the mob's new angle to the relative position vector
                        if (this.target.isVerticesChange) {
                            Matter.Body.setPosition(this, this.target.vertices[this.targetVertex])
                        } else {
                            Matter.Body.setPosition(this, Vector.add(Vector.add(rotate, this.target.velocity), this.target.position))
                        }
                        if (this.target.isBoss) {
                            if (this.target.speed > 6.5) Matter.Body.setVelocity(this.target, Vector.mult(this.target.velocity, 0.975))
                        } else {
                            if (this.target.speed > 2.5) Matter.Body.setVelocity(this.target, Vector.mult(this.target.velocity, 0.94))
                        }

                        Matter.Body.setAngularVelocity(this.target, this.target.angularVelocity * 0.9);
                        if (this.target.isShielded) {
                            this.target.damage(this.damage, true);
                            const SCALE = 1 - 0.004 / remotePlayers[id].tech.bulletsLastLonger //shrink if mob is shielded
                            Matter.Body.scale(this, SCALE, SCALE);
                            this.radius *= SCALE;
                        } else {
                            this.target.damage(this.damage);
                        }
                    } else if (this.target !== null) { //look for a new target
                        this.collisionFilter.category = cat.body;
                        this.collisionFilter.mask = cat.mob | cat.player //| cat.mobShield //cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield
                        Matter.Body.setVelocity(this, { x: this.target.velocity.x, y: this.target.velocity.y });
                        if (remotePlayers[id].tech.isSpawnBulletsOnDeath && bullet.length < 180 && !this.target.mobBullet) {
                            let targets = []
                            if(m.alive) {
                                targets.push(player);
                            }
                            for (let i = 0, len = mob.length; i < len; i++) {
                                const dist = Vector.magnitudeSquared(Vector.sub(this.position, mob[i].position));
                                if (dist < 1000000) targets.push(mob[i])
                            }
                            const radius = Math.min(this.radius * 0.5, 9)
                            const len = bullet.length < 80 ? 2 : 1
                            for (let i = 0; i < len; i++) {
                                if (targets.length - i > 0) {
                                    const index = Math.floor(Math.random() * targets.length)
                                    const speed = 6 + 6 * Math.random()
                                    const velocity = Vector.mult(Vector.normalise(Vector.sub(targets[index].position, this.position)), speed)
                                    b2.foam(this.position, Vector.rotate(velocity, 0.5 * (Math.random() - 0.5)), radius, id)
                                } else {
                                    b2.foam(this.position, Vector.rotate({
                                        x: 15 + 10 * Math.random(),
                                        y: 0
                                    }, 2 * Math.PI * Math.random()), radius, id)
                                }
                            }
                        }
                        this.target = null
                    } else if (Matter.Query.point(map, this.position).length > 0) { //slow when touching map
                        const slow = 0.87
                        Matter.Body.setVelocity(this, { x: this.velocity.x * slow, y: this.velocity.y * slow });
                        const SCALE = 0.97
                        Matter.Body.scale(this, SCALE, SCALE);
                        this.radius *= SCALE;
                        // } else if (Matter.Query.collides(this, body).length > 0) {
                    } else if (Matter.Query.point(body, this.position).length > 0) { //slow when touching blocks
                        const slow = 0.94
                        Matter.Body.setVelocity(this, { x: this.velocity.x * slow, y: this.velocity.y * slow });
                        const SCALE = 0.99
                        Matter.Body.scale(this, SCALE, SCALE);
                        this.radius *= SCALE;
                    } else {
                        if (!this.target && m.alive && Matter.Query.collides(this, [player]).length) {
                            this.target = player;
                            this.targetRelativePosition = Vector.rotate(Vector.sub(this.position, player.position), -m.angle);
                            Matter.Body.setVelocity(this, { x: 0, y: 0 });
                            this.collisionFilter.mask = null;
                        }
                        this.force.y += this.mass * remotePlayers[id].tech.foamGravity; //gravity
                        if (remotePlayers[id].tech.isFoamAttract) {
                            const potentialTargets = [...mob];
                            if (m.alive) {
                                potentialTargets.push(player);
                            }
                            
                            for (let i = 0, len = potentialTargets.length; i < len; i++) {
                                const target = potentialTargets[i];
                                const range = Vector.magnitude(Vector.sub(target.position, this.position))
                                if (
                                    (target.mob ? (!target.isBadTarget && target.alive && !target.isInvulnerable) : m.alive) &&
                                    range < 500 &&
                                    Matter.Query.ray(map, this.position, target.position).length === 0
                                ) {
                                    const mag = 0.001 * Math.min(1, 200 / range)
                                    this.force = Vector.mult(Vector.normalise(Vector.sub(target.position, this.position)), this.mass * mag)
                                    const slow = 0.98
                                    Matter.Body.setVelocity(this, { x: this.velocity.x * slow, y: this.velocity.y * slow });
                                    break
                                }
                            }
                        }
                    }
                    if (this.nextPortCycle < simulation.cycle) { //teleport around if you have remotePlayers[id].tech.isBulletTeleport
                        this.nextPortCycle = simulation.cycle + this.portFrequency
                        const range = 13 * Math.sqrt(this.radius) * Math.random()
                        Matter.Body.setPosition(this, Vector.add(this.position, Vector.rotate({
                            x: range,
                            y: 0
                        }, 2 * Math.PI * Math.random())))
                    }
                }
            });
            if (remotePlayers[id].tech.isBulletTeleport) bullet[me].nextPortCycle = simulation.cycle + bullet[me].portFrequency
            Composite.add(engine.world, bullet[me]); bullet[me].remoteBullet = true; bullet[me].collisionFilter.group = -id; //add bullet to world
            Matter.Body.setVelocity(bullet[me], velocity);
        };
        window.b2.harpoon = (where, target, angle = remotePlayers[id].angle2, harpoonSize = 1, isReturn = false, totalCycles = 35, isReturnAmmo = true, thrust = 0.1, id) => {
            const me = bullet.length;
            const returnRadius = 100 * Math.sqrt(harpoonSize)
            let shape
            if (remotePlayers[id].tech.isRebar) {
                const long = remotePlayers[id].tech.isMaul ? 32 : 65
                const tall = remotePlayers[id].tech.isMaul ? 25 : 5
                shape = [{
                    x: -long * harpoonSize,
                    y: tall * harpoonSize,
                    index: 0,
                    isInternal: false
                }, {
                    x: -long * harpoonSize * 1.05,
                    y: 0,
                    index: 1,
                    isInternal: false
                }, {
                    x: -long * harpoonSize,
                    y: -tall * harpoonSize,
                    index: 2,
                    isInternal: false
                }, {
                    x: long * harpoonSize,
                    y: -tall * harpoonSize,
                    index: 3,
                    isInternal: false
                }, {
                    x: long * harpoonSize * 1.05,
                    y: 0,
                    index: 4,
                    isInternal: false
                }, {
                    x: long * harpoonSize,
                    y: tall * harpoonSize,
                    index: 5,
                    isInternal: false
                }]
            } else {
                shape = [{
                    x: -40 * harpoonSize,
                    y: 2 * harpoonSize,
                    index: 0,
                    isInternal: false
                }, {
                    x: -40 * harpoonSize,
                    y: -2 * harpoonSize,
                    index: 1,
                    isInternal: false
                }, {
                    x: 50 * harpoonSize,
                    y: -3 * harpoonSize,
                    index: 3,
                    isInternal: false
                }, {
                    x: 30 * harpoonSize,
                    y: 2 * harpoonSize,
                    index: 4,
                    isInternal: false
                }]
            }
            bullet[me] = Bodies.fromVertices(where.x, where.y, shape, {
                cycle: 0,
                angle: angle,
                friction: 1,
                frictionAir: 0.4,
                // thrustMag: 0.1,
                drain: remotePlayers[id].tech.isRailEnergy ? 0.0002 : 0.006,
                turnRate: isReturn ? 0.1 : 0.03, //0.015
                drawStringControlMagnitude: 3000 + 5000 * Math.random(),
                drawStringFlip: (Math.round(Math.random()) ? 1 : -1),
                dmg: 6, //damage done in addition to the damage from momentum
                classType: "bullet",
                endCycle: simulation.cycle + totalCycles * 2.5 + 40,
                collisionFilter: {
                    category: cat.body,
                    mask: remotePlayers[id].tech.isShieldPierce ? cat.map | cat.body | cat.mob | cat.mobBullet | cat.player : cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield | cat.player,
                },
                minDmgSpeed: 4,
                lookFrequency: Math.floor(7 + Math.random() * 3),
                density: remotePlayers[id].tech.harpoonDensity * (remotePlayers[id].tech.isRebar ? 0.6 : 1), //0.001 is normal for blocks,  0.004 is normal for harpoon,  0.004*6 when buffed
                foamSpawned: 0,
                beforeDmg(who) {
                    if (remotePlayers[id].tech.isShieldPierce && who.isShielded) { //disable shields
                        who.isShielded = false
                        requestAnimationFrame(() => {
                            who.isShielded = true
                        });
                    }
                    if (remotePlayers[id].tech.fragments) {
                        b2.targetedNail(this.vertices[2], remotePlayers[id].tech.fragments * Math.floor(2 + Math.random()))
                        if (!isReturn) this.endCycle = 0;
                    }
                    if (!who.isBadTarget) {
                        if (isReturn) {
                            this.do = this.returnToPlayer
                        } else {
                            this.frictionAir = 0.01
                            this.do = () => {
                                this.force.y += this.mass * 0.003; //gravity
                                this.draw();
                            }
                        }
                    }
                    if (remotePlayers[id].tech.isFoamBall && this.foamSpawned < 55) {
                        for (let i = 0, len = Math.min(30, 2 + 3 * Math.sqrt(this.mass)); i < len; i++) {
                            const radius = 5 + 9 * Math.random()
                            const velocity = { x: Math.max(0.5, 2 - radius * 0.1), y: 0 }
                            b2.foam(this.position, Vector.rotate(velocity, 6.28 * Math.random()), radius, id)
                            this.foamSpawned++
                        }
                    }
                    if (remotePlayers[id].tech.isHarpoonPowerUp && simulation.cycle - 480 < remotePlayers[id].tech.harpoonPowerUpCycle) {
                        Matter.Body.setDensity(this, 1.8 * remotePlayers[id].tech.harpoonDensity); //+90% damage after pick up power up for 8 seconds
                    } else if (remotePlayers[id].tech.isHarpoonFullHealth && who.health === 1) {
                        Matter.Body.setDensity(this, 2.2 * remotePlayers[id].tech.harpoonDensity); //+90% damage if mob has full health do
                        simulation.ephemera.push({
                            count: 2, //cycles before it self removes
                            vertices: this.vertices,
                            do() {
                                this.count--
                                if (this.count < 0) simulation.removeEphemera(this)
                                ctx.beginPath();
                                ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
                                for (let j = 1, len = this.vertices.length; j < len; j += 1) ctx.lineTo(this.vertices[j].x, this.vertices[j].y);
                                ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
                                ctx.lineJoin = "miter"
                                ctx.miterLimit = 20;
                                ctx.lineWidth = 40;
                                ctx.strokeStyle = "rgba(255,0,100,0.35)";
                                ctx.stroke();
                                ctx.lineWidth = 10;
                                ctx.strokeStyle = `#f07`;
                                ctx.stroke();
                                ctx.lineJoin = "round"
                                ctx.miterLimit = 5
                                ctx.fillStyle = "#000"
                                ctx.fill();
                            },
                        })
                    }
                    if (remotePlayers[id].tech.isBreakHarpoon && Math.random() < 0.1) {
                        if (remotePlayers[id].tech.isBreakHarpoonGain) {
                            powerUps.spawn(remotePlayers[id].pos.x, remotePlayers[id].pos.y - 50, "research");
                            powerUps.spawn(remotePlayers[id].pos.x - 20, remotePlayers[id].pos.y + 15, "research");
                            powerUps.spawn(remotePlayers[id].pos.x + 20, remotePlayers[id].pos.y + 15, "boost");
                            b2.targetedNail(this.position, Math.floor(1 + 1.5 * Math.random()))
                        }
                        this.endCycle += 60 //so it lasts a bit longer
                        this.frictionAir = 0.01
                        //add spin
                        Matter.Body.setAngularVelocity(this, 0.7 * (Math.random() - 0.5))
                        //cap speed
                        const unit = Vector.normalise(this.velocity)
                        Matter.Body.setVelocity(this, Vector.mult(unit, Math.min(this.speed, 20)));
                        //stop behavior
                        this.do = () => {
                            this.force.y += this.mass * 0.005; //gravity
                        }
                    }
                },
                caughtPowerUp: null,
                dropCaughtPowerUp() {
                    if (this.caughtPowerUp) {
                        this.caughtPowerUp.collisionFilter.category = cat.powerUp
                        this.caughtPowerUp.collisionFilter.mask = cat.map | cat.powerUp
                        this.caughtPowerUp = null
                    }
                },
                onEnd() {
                    if (this.caughtPowerUp && !simulation.isChoosing && (this.caughtPowerUp.name !== "heal" || m.health !== m.maxHealth || remotePlayers[id].tech.isOverHeal)) {
                        let index = null //find index
                        for (let i = 0, len = powerUp.length; i < len; ++i) {
                            if (powerUp[i] === this.caughtPowerUp) index = i
                        }
                        if (index !== null) {
                            powerUps.onPickUp(this.caughtPowerUp);
                            Matter.Composite.remove(engine.world, this.caughtPowerUp);
                            powerUp.splice(index, 1);
                            if (remotePlayers[id].tech.isHarpoonPowerUp) remotePlayers[id].tech.harpoonPowerUpCycle = simulation.cycle
                        } else {
                            this.dropCaughtPowerUp()
                        }
                    } else {
                        this.dropCaughtPowerUp()
                    }
                },
                drawDamageAura() {
                    ctx.beginPath();
                    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
                    for (let j = 1, len = this.vertices.length; j < len; j += 1) ctx.lineTo(this.vertices[j].x, this.vertices[j].y);
                    ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
                    ctx.lineJoin = "miter"
                    ctx.miterLimit = 20;
                    ctx.lineWidth = 15;
                    ctx.strokeStyle = "rgba(255,0,100,0.25)";
                    ctx.stroke();
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = `#f07`;
                    ctx.stroke();
                    ctx.lineJoin = "round"
                    ctx.miterLimit = 5
                    ctx.fillStyle = "#000"
                    ctx.fill();
                },
                drawString() {
                    ropeIndex = this.vertices.length - 1
                    const where = { x: remotePlayers[id].pos.x + 30 * Math.cos(remotePlayers[id].angle2), y: remotePlayers[id].pos.y + 30 * Math.sin(remotePlayers[id].angle2) }
                    const sub = Vector.sub(where, this.vertices[ropeIndex])
                    const perpendicular = Vector.mult(Vector.normalise(Vector.perp(sub)), this.drawStringFlip * Math.min(80, 10 + this.drawStringControlMagnitude / (10 + Vector.magnitude(sub))))
                    const controlPoint = Vector.add(Vector.add(where, Vector.mult(sub, -0.5)), perpendicular)
                    ctx.strokeStyle = "#000" // "#0ce"
                    ctx.lineWidth = 0.5
                    ctx.beginPath();
                    ctx.moveTo(where.x, where.y);
                    ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, this.vertices[ropeIndex].x, this.vertices[ropeIndex].y)
                    // ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
                    ctx.stroke();
                },
                draw() { },
                returnToPlayer() {
                    if (Vector.magnitude(Vector.sub(this.position, remotePlayers[id].pos)) < returnRadius) { //near remotePlayers[id]
                        this.endCycle = 0;
                        const momentum = Vector.mult(Vector.sub(this.velocity, remotePlayers[id].velocity), (remotePlayers[id].crouch ? 0.0001 : 0.0002))
                        remotePlayers[id].force.x += momentum.x
                        remotePlayers[id].force.y += momentum.y
                    } else {
                        const sub = Vector.sub(this.position, remotePlayers[id].pos)
                        const rangeScale = 1 + 0.000001 * Vector.magnitude(sub) * Vector.magnitude(sub) //return faster when far from remotePlayers[id]
                        const returnForce = Vector.mult(Vector.normalise(sub), rangeScale * thrust * this.mass)
                        if (m.energy > this.drain) m.energy -= this.drain
                        if (m.energy < 0.05) {
                            this.force.x -= returnForce.x * 0.15
                            this.force.y -= returnForce.y * 0.15
                        } else { //if (m.cycle + 20 * b.fireCDscale < m.fireCDcycle)
                            this.force.x -= returnForce.x
                            this.force.y -= returnForce.y
                        }
                        this.grabPowerUp()
                    }
                    this.draw();
                },
                grabPowerUp() { //grab power ups near the tip of the harpoon
                    const grabPowerUpIndex = 2
                    if (this.caughtPowerUp) {
                        Matter.Body.setPosition(this.caughtPowerUp, Vector.add(this.vertices[grabPowerUpIndex], this.velocity))  //this.vertices[2]
                        Matter.Body.setVelocity(this.caughtPowerUp, { x: 0, y: 0 })
                    } else { //&& simulation.cycle % 2 
                        for (let i = 0, len = powerUp.length; i < len; ++i) {
                            if (remotePlayers[id].tech.isEnergyNoAmmo && powerUp[i].name === "ammo") continue
                            const radius = powerUp[i].circleRadius + 50
                            if (Vector.magnitudeSquared(Vector.sub(this.vertices[grabPowerUpIndex], powerUp[i].position)) < radius * radius && !powerUp[i].isGrabbed) {  //this.vertices[2]
                                if (powerUp[i].name !== "heal" || m.health !== m.maxHealth || remotePlayers[id].tech.isOverHeal) {
                                    powerUp[i].isGrabbed = true
                                    this.caughtPowerUp = powerUp[i]
                                    Matter.Body.setVelocity(powerUp[i], { x: 0, y: 0 })
                                    Matter.Body.setPosition(powerUp[i], this.vertices[grabPowerUpIndex])
                                    powerUp[i].collisionFilter.category = 0
                                    powerUp[i].collisionFilter.mask = 0
                                    thrust *= 0.6
                                    this.endCycle += 0.5 //it pulls back slower, so this prevents it from ending early
                                    break //just pull 1 power up if possible
                                }
                            }
                        }
                    }
                },
                do() {
                    this.cycle++
                    if (isReturn || target) {
                        if (isReturn) {
                            if (this.cycle > totalCycles) { //return to remotePlayers[id]  //|| !input.fire
                                this.do = this.returnToPlayer
                                if (this.angularSpeed < 0.5) this.torque += this.inertia * 0.001 * (Math.random() - 0.5) //(Math.round(Math.random()) ? 1 : -1)
                                Matter.Sleeping.set(this, false)
                                this.endCycle = simulation.cycle + 240
                                const momentum = Vector.mult(Vector.sub(this.velocity, remotePlayers[id].velocity), (remotePlayers[id].crouch ? 0.00015 : 0.0003)) //recoil on jerking line
                                remotePlayers[id].force.x += momentum.x
                                remotePlayers[id].force.y += momentum.y
                                requestAnimationFrame(() => { //delay this for 1 cycle to get the proper hit graphics
                                    this.collisionFilter.category = 0
                                    this.collisionFilter.mask = 0
                                });
                            } else {
                                this.grabPowerUp()
                            }
                        }
                        if (target) { //rotate towards the target
                            const face = {
                                x: Math.cos(this.angle),
                                y: Math.sin(this.angle)
                            };
                            const vectorGoal = Vector.normalise(Vector.sub(this.position, target.position));
                            if (Vector.cross(vectorGoal, face) > 0) {
                                Matter.Body.rotate(this, this.turnRate);
                            } else {
                                Matter.Body.rotate(this, -this.turnRate);
                            }
                        }
                        this.force.x += thrust * this.mass * Math.cos(this.angle);
                        this.force.y += thrust * this.mass * Math.sin(this.angle);
                    }
                    this.draw()
                },
            });
            if (!isReturn && !target) {
                Matter.Body.setVelocity(bullet[me], {
                    x: 0.7 * remotePlayers[id].velocity.x + 600 * thrust * Math.cos(bullet[me].angle),
                    y: 0.5 * remotePlayers[id].velocity.x + 600 * thrust * Math.sin(bullet[me].angle)
                });
                bullet[me].frictionAir = 0.002
                bullet[me].do = function () {
                    if (this.speed < 20) this.force.y += 0.0005 * this.mass;
                    this.draw();
                }
            }
            if (remotePlayers[id].tech.isHarpoonPowerUp && simulation.cycle - 480 < remotePlayers[id].tech.harpoonPowerUpCycle) { //8 seconds
                if (isReturn) {
                    bullet[me].draw = function () {
                        this.drawDamageAura()
                        this.drawString()
                    }
                } else {
                    bullet[me].draw = function () {
                        this.drawDamageAura()
                    }
                }
            } else if (isReturn) {
                bullet[me].draw = function () {
                    this.drawString()
                }
            }
            Composite.add(engine.world, bullet[me]); bullet[me].remoteBullet = true; bullet[me].collisionFilter.group = -id; //add bullet to world
        }
        window.b2.mine = (where, velocity, angle = 0, id) => {
            const bIndex = bullet.length;
            bullet[bIndex] = Bodies.rectangle(where.x, where.y, 45, 16, {
                angle: angle,
                friction: 1,
                frictionStatic: 1,
                frictionAir: 0,
                restitution: 0,
                dmg: 0, //damage done in addition to the damage from momentum
                classType: "bullet",
                bulletType: "mine",
                collisionFilter: {
                    group: -id,
                    category: cat.body,
                    mask: cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield | cat.player //  | cat.bullet   //doesn't collide with other bullets until it lands  (was crashing into bots)
                },
                minDmgSpeed: 5,
                stillCount: 0,
                isArmed: false,
                endCycle: Infinity,
                lookFrequency: 0,
                range: 700 - 300 * remotePlayers[id].tech.isFoamMine,
                beforeDmg() { },
                onEnd() {
                    if (this.isArmed && !remotePlayers[id].tech.isMineSentry) {
                        if (remotePlayers[id].tech.isFoamMine) {
                            //send 14 in random directions slowly
                            for (let i = 0; i < 12; i++) {
                                const radius = 13 + 8 * Math.random()
                                const velocity = { x: 0.5 + 5.5 * Math.random(), y: 0 }
                                b2.foam(this.position, Vector.rotate(velocity, this.angle + 1.57 + 3 * (Math.random() - 0.5)), radius, id) //6.28 * Math.random()
                            }
                            //send 40 targeted
                            let count = 0
                            let cycle = () => {
                                if (count < 50) {
                                    if (!simulation.paused && !simulation.isChoosing) { //!(simulation.cycle % 1) &&
                                        count++
                                        b2.targetedFoam(this.position, 1, 21 + 7 * Math.random(), 1200, true, id)
                                    }
                                    requestAnimationFrame(cycle);
                                }
                            }
                            requestAnimationFrame(cycle)
                        } else if (remotePlayers[id].tech.isSuperMine) {
                            b2.targetedBall(this.position, 22 + 2 * remotePlayers[id].tech.extraSuperBalls, 40 + 10 * Math.random(), 1200, 2.2, id)
                        } else {
                            b2.targetedNail(this.position, 22, 40 + 10 * Math.random(), 1200, 2.2, id)
                        }
                    }
                },
                do() {
                    this.force.y += this.mass * 0.002; //extra gravity
                    let collide = Matter.Query.collides(this, map) //check if collides with map
                    if (collide.length > 0) {
                        for (let i = 0; i < collide.length; i++) {
                            if (collide[i].bodyA.collisionFilter.category === cat.map) { // || collide[i].bodyB.collisionFilter.category === cat.map) {
                                const angle = Vector.angle(collide[i].normal, { x: 1, y: 0 })
                                Matter.Body.setAngle(this, Math.atan2(collide[i].tangent.y, collide[i].tangent.x))
                                for (let j = 0; j < 10; j++) { //move until touching map again after rotation
                                    if (Matter.Query.collides(this, map).length > 0) { //touching map
                                        if (angle > -0.2 || angle < -1.5) { //don't stick to level ground
                                            Matter.Body.setVelocity(this, { x: 0, y: 0 });
                                            Matter.Body.setStatic(this, true) //don't set to static if not touching map
                                            this.collisionFilter.category = 0
                                            this.collisionFilter.mask = 0 //cat.map | cat.bullet
                                        } else {
                                            Matter.Body.setVelocity(this, { x: 0, y: 0 });
                                            Matter.Body.setAngularVelocity(this, 0)
                                        }
                                        this.arm();
                                        setTimeout(() => {
                                            if (Matter.Query.collides(this, map).length === 0 || Matter.Query.point(map, this.position).length > 0) {
                                                this.endCycle = 0 // if not touching map explode
                                                this.isArmed = false
                                                b2.mine(this.position, this.velocity, this.angle, id)
                                            }
                                        }, 100);
                                        break
                                    }
                                    Matter.Body.setPosition(this, Vector.add(this.position, Vector.mult(collide[i].normal, 2))) //move until you are touching the wall
                                }
                                break
                            }
                        }
                    } else {
                        if (this.speed < 1 && this.angularSpeed < 0.01) this.stillCount++
                    }
                    if (this.stillCount > 25) this.arm();
                },
                arm() {
                    this.collisionFilter.mask = cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield | cat.bullet | cat.player //can now collide with other bullets
                    this.lookFrequency = simulation.cycle + 60
                    this.do = function () { //overwrite the do method for this bullet
                        this.force.y += this.mass * 0.002; //extra gravity
                        if (simulation.cycle > this.lookFrequency) {
                            this.isArmed = true
                            this.lookFrequency = 55 + Math.floor(22 * Math.random())
                            simulation.drawList.push({ x: this.position.x, y: this.position.y, radius: 10, color: "#f00", time: 4 });
                            this.do = function () { //overwrite the do method for this bullet
                                this.force.y += this.mass * 0.002; //extra gravity
                                if (!(simulation.cycle % this.lookFrequency)) { //find mob targets
                                    const random = 300 * Math.random()
                                    const targets = [...mob, player]
                                    for (let i = 0, len = targets.length; i < len; ++i) {
                                        if (
                                            targets[i].id != id &&
                                            Vector.magnitude(Vector.sub(this.position, targets[i].position)) < this.range + (targets[i] == player ? m.radius : targets[i].radius) + random &&
                                            Matter.Query.ray(map, this.position, targets[i].position).length === 0 &&
                                            Matter.Query.ray(body, this.position, targets[i].position).length === 0
                                        ) {
                                            if (remotePlayers[id].tech.isStun) b.AoEStunEffect(this.position, this.range + targets[i].radius + random); //AoEStunEffect(where, range, cycles = 90 + 60 * Math.random()) {
                                            if (remotePlayers[id].tech.isMineSentry) {
                                                this.lookFrequency = Math.floor(5 + 7 * remotePlayers[id].fireCDscale + 10 * (remotePlayers[id].tech.oneSuperBall && remotePlayers[id].tech.isSuperMine) + Math.floor(2 * Math.random()))
                                                // this.endCycle = Infinity
                                                this.shots = remotePlayers[id].tech.sentryAmmo
                                                this.do = function () { //overwrite the do method for this bullet
                                                    this.force.y += this.mass * 0.002; //extra gravity
                                                    if (!(simulation.cycle % this.lookFrequency)) { //find mob targets
                                                        if (remotePlayers[id].tech.isFoamMine) {
                                                            this.shots -= 0.6 * b2.targetedFoam(this.position, 1, 21 + 7 * Math.random(), 1200, false, id)
                                                            b2.targetedFoam(this.position, 1, 21 + 7 * Math.random(), 1200, false, id)
                                                        } else if (remotePlayers[id].tech.isSuperMine) {
                                                            const cost = remotePlayers[id].tech.oneSuperBall ? 2 : 0.7
                                                            this.shots -= cost * b2.targetedBall(this.position, 1, 42 + 12 * Math.random(), 1200, false, id)
                                                            for (let i = 0, len = remotePlayers[id].tech.extraSuperBalls / 4; i < len; i++) {
                                                                if (Math.random() < 0.33) b2.targetedBall(this.position, 1, 42 + 12 * Math.random(), 1200, false, id)
                                                            }
                                                        } else {
                                                            this.shots -= b2.targetedNail(this.position, 1, 45 + 5 * Math.random(), 1100, 2.3, id)
                                                        }
                                                        if (this.shots < 0) this.endCycle = 0
                                                        if (!(simulation.cycle % (this.lookFrequency * 6))) {
                                                            simulation.drawList.push({ x: this.position.x, y: this.position.y, radius: 8, color: "#fe0", time: 4 });
                                                        }
                                                    }
                                                }
                                                break
                                            } else {
                                                this.endCycle = 0 //end life if mob is near and visible
                                                break
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
            });
            bullet[bIndex].torque += bullet[bIndex].inertia * 0.0002 * (0.5 - Math.random())
            Matter.Body.setVelocity(bullet[bIndex], velocity);
            Composite.add(engine.world, bullet[bIndex]);
        }
        window.b2.targetedNail = (position, num = 1, speed = 40 + 10 * Math.random(), range = 1200, damage = 1.4, id) => {
            let shotsFired = 0
            const targets = [] //target nearby mobs
            let comp = [...mob, player]
            for (let i = 0, len = comp.length; i < len; i++) {
                const dist = Vector.magnitude(Vector.sub(position, comp[i].position));
                if (
                    dist < range + (comp[i] == player ? m.radius : comp[i].radius) &&
                    comp[i].id != id &&
                    Matter.Query.ray(map, position, comp[i].position).length === 0 &&
                    Matter.Query.ray(body, position, comp[i].position).length === 0
                ) {
                    targets.push(Vector.add(comp[i].position, Vector.mult(comp[i].velocity, dist / 60))) //predict where the mob will be in a few cycles
                }
            }
            for (let i = 0; i < num; i++) {
                if (targets.length > 0) { // aim near a random target in array
                    const index = Math.floor(Math.random() * targets.length)
                    const SPREAD = 150 / targets.length
                    const WHERE = {
                        x: targets[index].x + SPREAD * (Math.random() - 0.5),
                        y: targets[index].y + SPREAD * (Math.random() - 0.5)
                    }
                    b2.nail(position, Vector.mult(Vector.normalise(Vector.sub(WHERE, position)), speed), damage, id)
                    shotsFired++
                } else { // aim in random direction
                    const ANGLE = 2 * Math.PI * Math.random()
                    b2.nail(position, {
                        x: speed * Math.cos(ANGLE),
                        y: speed * Math.sin(ANGLE)
                    }, damage, id)
                    shotsFired++
                }
            }
            return shotsFired
        }
        window.b2.grapple = function(where, angle, id) {
            const me = bullet.length;
            const returnRadius = 100
            bullet[me] = Bodies.fromVertices(where.x, where.y, [{
                x: -40,
                y: 2,
                index: 0,
                isInternal: false
            }, {
                x: -40,
                y: -2,
                index: 1,
                isInternal: false
            }, {
                x: 37,
                y: -2,
                index: 2,
                isInternal: false
            }, {
                x: 40,
                y: -1,
                index: 3,
                isInternal: false
            }, {
                x: 37,
                y: 3,
                index: 4,
                isInternal: false
            }],
                {
                    angle: angle,
                    friction: 1,
                    frictionAir: 0.4,
                    thrustMag: 0.17,
                    dmg: 7, //damage done in addition to the damage from momentum
                    classType: "bullet",
                    endCycle: simulation.cycle + 70,
                    isSlowPull: false,
                    drawStringControlMagnitude: 1000 + 1000 * Math.random(),
                    drawStringFlip: (Math.round(Math.random()) ? 1 : -1),
                    attached: false,
                    glowColor: remotePlayers[id].tech.hookNails ? "rgba(200,0,0,0.07)" : remotePlayers[id].tech.isHarmReduce ? "rgba(50,100,255,0.1)" : "rgba(0,200,255,0.07)",
                    collisionFilter: {
                        group: -id,
                        category: cat.body,
                        mask: remotePlayers[id].tech.isShieldPierce ? cat.body | cat.mob | cat.mobBullet : cat.body | cat.mob | cat.mobBullet | cat.mobShield | cat.player,
                    },
                    minDmgSpeed: 4,
                    // lookFrequency: Math.floor(7 + Math.random() * 3),
                    density: 0.004, //0.001 is normal for blocks,  0.004 is normal for harpoon
                    drain: 0.001,
                    powerUpDamage: remotePlayers[id].tech.isHarpoonPowerUp && simulation.cycle - 480 < remotePlayers[id].tech.harpoonPowerUpCycle,
                    draw() {
                        // draw rope
                        const where = { x: remotePlayers[id].pos.x + 30 * Math.cos(remotePlayers[id].angle2), y: remotePlayers[id].pos.y + 30 * Math.sin(remotePlayers[id].angle2) }
                        const sub = Vector.sub(where, this.vertices[0])
                        ctx.strokeStyle = "#000" // "#0ce"
                        ctx.lineWidth = 0.5
                        ctx.beginPath();
                        ctx.moveTo(where.x, where.y);
                        if (this.attached) {
                            const controlPoint = Vector.add(where, Vector.mult(sub, -0.5))
                            ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, this.vertices[0].x, this.vertices[0].y)
                        } else {
                            const long = Math.max(Vector.magnitude(sub), 60)
                            const perpendicular = Vector.mult(Vector.normalise(Vector.perp(sub)), this.drawStringFlip * Math.min(0.7 * long, 10 + this.drawStringControlMagnitude / (10 + Vector.magnitude(sub))))
                            const controlPoint = Vector.add(Vector.add(where, Vector.mult(sub, -0.5)), perpendicular)
                            ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, this.vertices[0].x, this.vertices[0].y)
                        }
                        // ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
                        // ctx.stroke();
                        ctx.strokeStyle = this.glowColor // "#0ce"
                        ctx.lineWidth = 10
                        ctx.stroke();
                        ctx.strokeStyle = "#000" // "#0ce"
                        ctx.lineWidth = 0.5
                        ctx.stroke();

                        if (this.powerUpDamage) {
                            ctx.beginPath();
                            ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
                            ctx.lineTo(this.vertices[1].x, this.vertices[1].y);
                            ctx.lineTo(this.vertices[2].x, this.vertices[2].y);
                            ctx.lineTo(this.vertices[3].x, this.vertices[3].y);
                            ctx.lineTo(this.vertices[4].x, this.vertices[4].y);
                            ctx.lineJoin = "miter"
                            ctx.miterLimit = 30;
                            ctx.lineWidth = 25;
                            ctx.strokeStyle = "rgba(0,255,255,0.4)";
                            ctx.stroke();
                            ctx.lineWidth = 8;
                            ctx.strokeStyle = "rgb(0,255,255)";
                            ctx.stroke();
                            ctx.lineJoin = "round"
                            ctx.miterLimit = 5
                            ctx.fillStyle = "#000"
                            ctx.fill();
                        }
                        //draw hook
                        ctx.beginPath();
                        ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
                        const spike = Vector.add(this.vertices[3], Vector.mult(Vector.sub(this.vertices[3], this.vertices[2]), 2))
                        ctx.moveTo(this.vertices[2].x, this.vertices[2].y);
                        ctx.lineTo(spike.x, spike.y);
                        ctx.lineTo(this.vertices[1].x, this.vertices[1].y);
                        ctx.fillStyle = '#000'
                        ctx.fill();
                    },
                    beforeDmg(who) {
                        if (remotePlayers[id].tech.isShieldPierce && who.isShielded) { //disable shields
                            who.isShielded = false
                            requestAnimationFrame(() => { who.isShielded = true });
                        }
                        if (remotePlayers[id].fieldCDcycle < remotePlayers[id].cycle + 30) remotePlayers[id].fieldCDcycle = remotePlayers[id].cycle + 30  //extra long cooldown on hitting mobs
                        if (remotePlayers[id].tech.hookNails) {
                            // if (remotePlayers[id].immuneCycle < remotePlayers[id].cycle + remotePlayers[id].collisionImmuneCycles) remotePlayers[id].immuneCycle = remotePlayers[id].cycle + 5; //player is immune to damage for 5 cycles
                            // b.explosion(this.position, 300 + 150 * Math.random()); //makes bullet do explosive damage at end
                            b2.targetedNail(this.position, remotePlayers[id].tech.hookNails, 40 + 10 * Math.random(), 1200, 1.4, id)
                            const ANGLE = 2 * Math.PI * Math.random() //make a few random ones
                            for (let i = 0; i < 4; i++) b2.nail(this.position, { x: 10.5 * Math.cos(ANGLE), y: 10.5 * Math.sin(ANGLE) }, 1.2, id)
                        }
                        // if (this.powerUpDamage) this.density = 2 * 0.004 //double damage after pick up power up for 8 seconds


                        if (remotePlayers[id].tech.isHarpoonPowerUp && simulation.cycle - 480 < remotePlayers[id].tech.harpoonPowerUpCycle) {
                            Matter.Body.setDensity(this, 1.8 * 0.004); //+90% damage after pick up power up for 8 seconds
                        } else if (remotePlayers[id].tech.isHarpoonFullHealth && who.health === 1) {
                            Matter.Body.setDensity(this, 2.11 * 0.004); //+90% damage if mob has full health do
                            simulation.ephemera.push({
                                count: 3, //cycles before it self removes
                                vertices: this.vertices,
                                do() {
                                    this.count--
                                    if (this.count < 0) simulation.removeEphemera(this)

                                    ctx.beginPath();
                                    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
                                    for (let j = 1, len = this.vertices.length; j < len; j += 1) ctx.lineTo(this.vertices[j].x, this.vertices[j].y);
                                    ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
                                    ctx.lineJoin = "miter"
                                    ctx.miterLimit = 20;
                                    ctx.lineWidth = 40;
                                    ctx.strokeStyle = "rgba(255,0,100,0.35)";
                                    ctx.stroke();
                                    ctx.lineWidth = 10;
                                    ctx.strokeStyle = `#f07`;
                                    ctx.stroke();
                                    ctx.lineJoin = "round"
                                    ctx.miterLimit = 5
                                    ctx.fillStyle = "#000"
                                    ctx.fill();
                                },
                            })
                        }


                        this.retract()
                    },
                    caughtPowerUp: null,
                    dropCaughtPowerUp() {
                        if (this.caughtPowerUp) {
                            this.caughtPowerUp.collisionFilter.category = cat.powerUp
                            this.caughtPowerUp.collisionFilter.mask = cat.map | cat.powerUp
                            this.caughtPowerUp = null
                        }
                    },
                    onEnd() {
                        if (this.caughtPowerUp && !simulation.isChoosing && (this.caughtPowerUp.name !== "heal" || remotePlayers[id].health !== remotePlayers[id].maxHealth || remotePlayers[id].tech.isOverHeal)) {
                            let index = null //find index
                            for (let i = 0, len = powerUp.length; i < len; ++i) {
                                if (powerUp[i] === this.caughtPowerUp) index = i
                            }
                            if (index !== null) {
                                powerUps.onPickUp(this.caughtPowerUp);
                                Matter.Composite.remove(engine.world, this.caughtPowerUp);
                                powerUp.splice(index, 1);
                                if (remotePlayers[id].tech.isHarpoonPowerUp) remotePlayers[id].tech.harpoonPowerUpCycle = simulation.cycle
                            } else {
                                this.dropCaughtPowerUp()
                            }
                        } else {
                            this.dropCaughtPowerUp()
                        }
                    },
                    retract() {
                        this.attached = false
                        this.do = this.returnToPlayer
                        this.endCycle = simulation.cycle + 60
                        Matter.Body.setDensity(this, 0.0005); //reduce density on return
                        if (this.angularSpeed < 0.5) this.torque += this.inertia * 0.001 * (Math.random() - 0.5) //(Math.round(Math.random()) ? 1 : -1)
                        this.collisionFilter.mask = 0//cat.map | cat.mob | cat.mobBullet | cat.mobShield // | cat.body
                        //recoil on pulling grapple back
                        // if (this.pickUpTarget.mass) console.log(this.pickUpTarget.mass)
                        const mag = this.pickUpTarget ? Math.min(5, Math.max(this.pickUpTarget.mass, 0.5)) : 0.5
                        const unit = Vector.normalise(Vector.sub(this.position, remotePlayers[id].pos))
                        const momentum = Vector.mult(unit, mag * (remotePlayers[id].crouch ? 0.1 : 0.2))
                        remotePlayers[id].force.x += momentum.x
                        remotePlayers[id].force.y += momentum.y
                    },
                    returnToPlayer() {
                        // if (remotePlayers[id].fieldCDcycle < remotePlayers[id].cycle + 5) remotePlayers[id].fieldCDcycle = remotePlayers[id].cycle + 5
                        if (Vector.magnitude(Vector.sub(this.position, remotePlayers[id].pos)) < returnRadius) { //near player
                            this.endCycle = 0;

                            //recoil on catching grapple
                            // const momentum = Vector.mult(Vector.sub(this.velocity, remotePlayers[id].velocity), (remotePlayers[id].crouch ? 0.0001 : 0.0002))
                            const unit = Vector.normalise(Vector.sub(this.velocity, remotePlayers[id].velocity))
                            const momentum = Vector.mult(unit, (remotePlayers[id].crouch ? 0.0001 : 0.0002))
                            remotePlayers[id].force.x += momentum.x
                            remotePlayers[id].force.y += momentum.y
                            if (this.pickUpTarget) {
                                if (remotePlayers[id].tech.isReel && this.blockDist > 15 && remotePlayers[id].immuneCycle < remotePlayers[id].cycle) {
                                    // console.log(0.0003 * Math.min(this.blockDist, 1000))
                                    remotePlayers[id].energy += 0.00113 * Math.min(this.blockDist, 800) * level.isReducedRegen //max 0.352 energy
                                    simulation.drawList.push({ //add dmg to draw queue
                                        x: remotePlayers[id].pos.x,
                                        y: remotePlayers[id].pos.y,
                                        radius: 10,
                                        color: remotePlayers[id].fieldMeterColor,
                                        time: simulation.drawTime
                                    });
                                }
                                remotePlayers[id].holdingTarget = this.pickUpTarget
                                // give block to player after it returns
                                remotePlayers[id].isHolding = true;
                                //conserve momentum when player mass changes
                                const blockMass = Math.min(5, this.pickUpTarget.mass)
                                const grappleMomentum = Vector.mult(Vector.normalise(this.velocity), 15 * blockMass)
                                const playerMomentum = Vector.mult(remotePlayers[id].velocity, remotePlayers[id].mass)
                                totalMomentum = Vector.add(playerMomentum, grappleMomentum)
                                Matter.Body.setVelocity(remotePlayers[id], Vector.mult(totalMomentum, 1 / (remotePlayers[id].defaultMass + blockMass)));

                                remotePlayers[id].definePlayerMass(remotePlayers[id].defaultMass + this.pickUpTarget.mass * remotePlayers[id].holdingMassScale)
                                //make block collide with nothing
                                remotePlayers[id].holdingTarget.collisionFilter.category = 0;
                                remotePlayers[id].holdingTarget.collisionFilter.mask = 0;
                                this.pickUpTarget = null
                            }
                        } else {
                            if (remotePlayers[id].energy > this.drain) remotePlayers[id].energy -= this.drain
                            const sub = Vector.sub(this.position, remotePlayers[id].pos)
                            const rangeScale = 1 + 0.000003 * Vector.magnitude(sub)  //return faster when far from player
                            const returnForce = Vector.mult(Vector.normalise(sub), rangeScale * this.thrustMag * this.mass)
                            this.force.x -= returnForce.x
                            this.force.y -= returnForce.y
                            this.grabPowerUp()
                            this.grabBlocks()
                        }
                        this.draw();
                    },
                    destroyBlocks() {//not used?
                        const blocks = Matter.Query.collides(this, body)
                        if (blocks.length && !blocks[0].bodyA.isNotHoldable) {
                            if (blocks[0].bodyA.mass > 2.5) this.retract()
                            const block = blocks[0].bodyA.vertices
                            Composite.remove(engine.world, blocks[0].bodyA)
                            body.splice(body.indexOf(blocks[0].bodyA), 1)
                            //animate the block fading away
                            simulation.ephemera.push({
                                count: 25, //cycles before it self removes
                                do() {
                                    this.count--
                                    if (this.count < 0) simulation.removeEphemera(this)
                                    ctx.beginPath();
                                    ctx.moveTo(block[0].x, block[0].y);
                                    for (let j = 1; j < block.length; j++) ctx.lineTo(block[j].x, block[j].y);
                                    ctx.lineTo(block[0].x, block[0].y);
                                    ctx.lineWidth = 2;
                                    ctx.strokeStyle = `rgba(0,0,0,${this.count / 25})`
                                    ctx.stroke();
                                },
                            })
                        }
                    },
                    pickUpTarget: null,
                    grabBlocks() {
                        if (this.pickUpTarget) { //if always attached to a block
                            //position block on hook
                            Matter.Body.setPosition(this.pickUpTarget, Vector.add(this.vertices[2], this.velocity))
                            Matter.Body.setVelocity(this.pickUpTarget, { x: 0, y: 0 })
                        } else {
                            const blocks = Matter.Query.collides(this, body)
                            if (blocks.length) {
                                for (let i = 0; i < blocks.length; i++) {
                                    if (blocks[i].bodyA.classType === "body" && !blocks[i].bodyA.isNotHoldable && blocks[0].bodyA.mass < 40) {
                                        this.retract()
                                        if (remotePlayers[id].tech.hookNails) {
                                            b2.targetedNail(this.position, 3 * remotePlayers[id].tech.hookNails, 40 + 10 * Math.random(), 1200, 1.4, id)
                                            const ANGLE = 2 * Math.PI * Math.random() //make a few random ones
                                            for (let i = 0; i < 13; i++) b.nail(this.position, { x: 10.5 * Math.cos(ANGLE), y: 10.5 * Math.sin(ANGLE) }, 1.2)

                                            const blockVertices = blocks[i].bodyA.vertices
                                            Composite.remove(engine.world, blocks[i].bodyA)
                                            body.splice(body.indexOf(blocks[i].bodyA), 1)
                                            //animate the block fading away
                                            simulation.ephemera.push({
                                                count: 25, //cycles before it self removes
                                                do() {
                                                    this.count--
                                                    if (this.count < 0) simulation.removeEphemera(this)
                                                    ctx.beginPath();
                                                    ctx.moveTo(blockVertices[0].x, blockVertices[0].y);
                                                    for (let j = 1; j < blockVertices.length; j++) ctx.lineTo(blockVertices[j].x, blockVertices[j].y);
                                                    ctx.lineTo(blockVertices[0].x, blockVertices[0].y);
                                                    ctx.lineWidth = 2;
                                                    ctx.strokeStyle = `rgba(0,0,0,${this.count / 25})`
                                                    ctx.stroke();
                                                },
                                            })
                                        } else {
                                            this.pickUpTarget = blocks[i].bodyA
                                            this.blockDist = Vector.magnitude(Vector.sub(this.pickUpTarget.position, remotePlayers[id].pos))
                                        }
                                    }
                                }
                            }
                        }
                    },
                    grabPowerUp() { //grab power ups near the tip of the harpoon
                        if (this.caughtPowerUp) {
                            Matter.Body.setPosition(this.caughtPowerUp, Vector.add(this.vertices[2], this.velocity))
                            Matter.Body.setVelocity(this.caughtPowerUp, { x: 0, y: 0 })
                        } else {
                            for (let i = 0, len = powerUp.length; i < len; ++i) {
                                if (remotePlayers[id].tech.isEnergyNoAmmo && powerUp[i].name === "ammo") continue
                                const radius = powerUp[i].circleRadius + 50
                                if (Vector.magnitudeSquared(Vector.sub(this.vertices[2], powerUp[i].position)) < radius * radius) {
                                    if (powerUp[i].name !== "heal" || remotePlayers[id].health !== remotePlayers[id].maxHealth || remotePlayers[id].tech.isOverHeal) {
                                        this.caughtPowerUp = powerUp[i]
                                        Matter.Body.setVelocity(powerUp[i], { x: 0, y: 0 })
                                        Matter.Body.setPosition(powerUp[i], this.vertices[2])
                                        powerUp[i].collisionFilter.category = 0
                                        powerUp[i].collisionFilter.mask = 0
                                        this.thrustMag *= 0.6
                                        this.endCycle += 0.5 //it pulls back slower, so this prevents it from ending early
                                        // this.retract()
                                        break //just pull 1 power up if possible
                                    }
                                }
                            }
                        }
                        remotePlayers[id].grabPowerUp();
                    },
                    do() {
                        if (remotePlayers[id].inputField) {
                            if (remotePlayers[id].fieldCDcycle < remotePlayers[id].cycle + 5) remotePlayers[id].fieldCDcycle = remotePlayers[id].cycle + 5
                            this.grabBlocks()
                            this.grabPowerUp()
                        } else {
                            this.retract()
                        }
                        //grappling hook
                        if (remotePlayers[id].inputField && Matter.Query.collides(this, map).length) {
                            Matter.Body.setPosition(this, Vector.add(this.position, { x: -20 * Math.cos(this.angle), y: -20 * Math.sin(this.angle) }))
                            if (Matter.Query.collides(this, map).length) {
                                if (remotePlayers[id].tech.hookNails) {
                                    b2.targetedNail(this.position, remotePlayers[id].tech.hookNails, 40 + 10 * Math.random(), 1200, 1.4, id) 
                                    const ANGLE = 2 * Math.PI * Math.random() //make a few random ones
                                    for (let i = 0; i < 4; i++) b.nail(this.position, { x: 10.5 * Math.cos(ANGLE), y: 10.5 * Math.sin(ANGLE) }, 1.2)

                                }
                                this.attached = true
                                Matter.Body.setVelocity(this, { x: 0, y: 0 });
                                Matter.Sleeping.set(this, true)
                                this.endCycle = simulation.cycle + 5
                                this.do = () => {
                                    if (remotePlayers[id].inputField && remotePlayers[id].fieldCDcycle < remotePlayers[id].cycle + 5) remotePlayers[id].fieldCDcycle = remotePlayers[id].cycle + 5
                                    this.grabPowerUp()

                                    //between player nose and the grapple
                                    const sub = Vector.sub(this.vertices[0], { x: remotePlayers[id].pos.x + 30 * Math.cos(remotePlayers[id].angle2), y: remotePlayers[id].pos.y + 30 * Math.sin(remotePlayers[id].angle2) })
                                    let dist = Vector.magnitude(sub)
                                    if (remotePlayers[id].inputField) {
                                        this.endCycle = simulation.cycle + 10
                                        if (remotePlayers[id].inputDown) { //down
                                            this.isSlowPull = true
                                            dist = 0
                                            remotePlayers[id].force.y += 3 * remotePlayers[id].mass * simulation.g; //adjust this to control fall rate while hooked and pressing down
                                        } else if (remotePlayers[id].inputUp) {
                                            this.isSlowPull = false
                                            remotePlayers[id].force.y -= remotePlayers[id].mass * simulation.g; //adjust this to control fall rate while hooked and pressing down
                                        }
                                        if (remotePlayers[id].energy < this.drain) this.isSlowPull = true

                                        // pulling friction that allowed a slight swinging, but has high linear pull at short dist
                                        const drag = 1 - 30 / Math.min(Math.max(100, dist), 700) - 0.1 * (remotePlayers[id].speed > 66)
                                        Matter.Body.setVelocity(remotePlayers[id], { x: remotePlayers[id].velocity.x * drag, y: remotePlayers[id].velocity.y * drag });
                                        const pull = Vector.mult(Vector.normalise(sub), 0.0004 * Math.min(Math.max(15, dist), this.isSlowPull ? 70 : 200))
                                        //original pulling force with high friction and very linear pull
                                        // Matter.Body.setVelocity(player, { x: remotePlayers[id].velocity.x * 0.85, y: remotePlayers[id].velocity.y * 0.85 });
                                        // const pull = Vector.mult(Vector.normalise(sub), 0.0008 * Math.min(Math.max(15, dist), this.isSlowPull ? 100 : 200))

                                        remotePlayers[id].force.x += pull.x
                                        remotePlayers[id].force.y += pull.y
                                        if (dist > 500) remotePlayers[id].energy -= this.drain
                                    } else {
                                        Matter.Sleeping.set(this, false)
                                        this.retract()
                                    }
                                    this.draw();
                                }
                            }
                        }
                        this.force.x += this.thrustMag * this.mass * Math.cos(this.angle);
                        this.force.y += this.thrustMag * this.mass * Math.sin(this.angle);
                        this.draw()
                    },
                });
            Composite.add(engine.world, bullet[me]); //add bullet to world
            Matter.Body.setVelocity(bullet[me], remotePlayers[id].velocity); //set velocity in direction of player
        }
        window.b2.iceIX = function(speed, dir, where, id) {
            const em = bullet.length;
            const THRUST = 0.0018
            const RADIUS = 18
            const SCALE = 1 - 0.11 / remotePlayers[id].tech.bulletsLastLonger
            bullet[em] = Bodies.polygon(where.x, where.y, 3, RADIUS, {
                angle: dir - Math.PI,
                // inertia: Infinity,
                spin: 0.00004 * (0.1 + Math.random()) * (Math.round(Math.random()) ? 1 : -1),
                friction: 0,
                frictionAir: 0.02,
                restitution: 0.9,
                dmg: 1.5, //damage done in addition to the damage from momentum
                lookFrequency: 14 + Math.floor(8 * Math.random()),
                endCycle: simulation.cycle + 65 * remotePlayers[id].tech.bulletsLastLonger + Math.floor(25 * Math.random()),
                classType: "bullet",
                collisionFilter: {
                    group: -id,
                    category: cat.body,
                    mask: cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield | cat.player //self collide
                },
                minDmgSpeed: 0,
                lockedOn: null,
                beforeDmg(who) {
                    if (!who.isInvulnerable) {
                        if (remotePlayers[id].tech.iceEnergy && !who.shield && !who.isShielded && who.isDropPowerUp && who.alive && remotePlayers[id].immuneCycle < remotePlayers[id].cycle) {
                            setTimeout(() => {
                                if (!who.alive) remotePlayers[id].energy += remotePlayers[id].tech.iceEnergy * 0.8 * level.isReducedRegen
                            }, 10);
                        }
                        mobs.statusSlow(who, remotePlayers[id].tech.iceIXFreezeTime)
                        this.endCycle = simulation.cycle
                    }
                    // if (remotePlayers[id].tech.isHeavyWater) mobs.statusDoT(who, 0.15, 300)
                },
                onEnd() { },
                do() {
                    // this.force.y += this.mass * 0.0002;
                    //find mob targets
                    if (!(simulation.cycle % this.lookFrequency)) {
                        Matter.Body.scale(this, SCALE, SCALE);
                        this.lockedOn = null;
                        let closeDist = Infinity;
                        for (let i = 0, len = mob.length; i < len; ++i) {
                            if (
                                !mob[i].isBadTarget &&
                                mob[i].id != id &&
                                Matter.Query.ray(map, this.position, mob[i].position).length === 0 &&
                                Matter.Query.ray(body, this.position, mob[i].position).length === 0 &&
                                !mob[i].isInvulnerable
                            ) {
                                const TARGET_VECTOR = Vector.sub(this.position, mob[i].position)
                                const DIST = Vector.magnitude(TARGET_VECTOR);
                                if (DIST < closeDist) {
                                    closeDist = DIST;
                                    this.lockedOn = mob[i]
                                }
                            }
                        }
                        const TARGET_VECTOR2 = Vector.sub(this.position, player.position)
                        const DIST = Vector.magnitude(TARGET_VECTOR2);
                        if (DIST < closeDist) {
                            closeDist = DIST;
                            this.lockedOn = player
                        }
                    }
                    if (this.lockedOn) { //accelerate towards mobs
                        this.force = Vector.mult(Vector.normalise(Vector.sub(this.lockedOn.position, this.position)), this.mass * THRUST)
                    } else {
                        this.force = Vector.mult(Vector.normalise(this.velocity), this.mass * THRUST)
                    }
                    this.torque += this.inertia * this.spin
                }
            })

            Composite.add(engine.world, bullet[em]); //add bullet to world
            // Matter.Body.setAngularVelocity(bullet[em], 2 * (0.5 - Math.random()))  //doesn't work due to high friction
            Matter.Body.setVelocity(bullet[em], {
                x: speed * Math.cos(dir),
                y: speed * Math.sin(dir)
            });
            Matter.Body.setAngularVelocity(bullet[em], 3000 * bullet[em].spin);
        }
        window.b2.flea = function(where, velocity, radius, id) {
            const em = bullet.length;
            bullet[em] = Bodies.polygon(where.x, where.y, 5, radius, {
                isFlea: true,
                angle: 0.5 * Math.random(),
                friction: 1,
                frictionStatic: 1,
                frictionAir: 0, //0.01,
                restitution: 0,
                density: 0.0005, //  0.001 is normal density
                lookFrequency: 19 + Math.floor(7 * Math.random()),
                endCycle: simulation.cycle + Math.floor((900 * remotePlayers[id].tech.bulletsLastLonger + 420 * Math.random()) + Math.max(0, 150 - bullet.length)), // 13 - 19s
                classType: "bullet",
                collisionFilter: {
                    group: -id,
                    category: cat.body,
                    mask: cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield | cat.player
                },
                minDmgSpeed: 0,
                lockedOn: null,
                delay: 50,
                cd: simulation.cycle + 10,
                dmg: 0,
                setDamage() { //dmg is set to zero after doing damage once, and set back to normal after jumping
                    this.dmg = radius * (remotePlayers[id].tech.isMutualism ? 3.3 : 1.1) //damage done in addition to the damage from momentum  //spores do 7 dmg, worms do 18
                },
                beforeDmg(who) {
                    Matter.Body.setVelocity(this, Vector.mult(Vector.normalise(Vector.sub(this.position, who.position)), 10 + 10 * Math.random())); //push away from target
                    this.cd = simulation.cycle + this.delay;
                    if (!who.isInvulnerable && this.dmg !== 0) {
                        this.endCycle -= 110
                        if (remotePlayers[id].tech.isSporeFreeze) mobs.statusSlow(who, 90)
                        if (remotePlayers[id].tech.isSpawnBulletsOnDeath && who.alive && who.isDropPowerUp) {
                            setTimeout(() => {
                                if (!who.alive) {
                                    for (let i = 0; i < 2; i++) { //spawn 2 more
                                        const speed = 10 + 5 * Math.random()
                                        const angle = 2 * Math.PI * Math.random()
                                        b.flea(this.position, {
                                            x: speed * Math.cos(angle),
                                            y: speed * Math.sin(angle)
                                        })
                                    }
                                }
                                this.endCycle = 0;
                            }, 1);
                        }
                        setTimeout(() => {
                            this.dmg = 0
                        })
                    }
                },
                onEnd() {
                    if (remotePlayers[id].tech.isMutualism && this.isMutualismActive && !remotePlayers[id].tech.isEnergyHealth) {
                        remotePlayers[id].health += 0.02
                    }
                },
                gravity: 0.002 + 0.002 * remotePlayers[id].tech.isSporeFollow,
                do() {
                    this.force.y += this.gravity * this.mass
                    if (this.cd < simulation.cycle && (Matter.Query.collides(this, map).length || Matter.Query.collides(this, body).length)) { //if on the ground and not on jump cooldown //
                        this.cd = simulation.cycle + this.delay;
                        this.lockedOn = null; //find a target
                        let closeDist = Infinity;
                        for (let i = 0, len = mob.length; i < len; ++i) {
                            if (
                                !mob[i].isBadTarget &&
                                !mob[i].isInvulnerable &&
                                mob[i].id != id &&
                                mob[i].alive &&
                                this.position.y - mob[i].position.y < 1500 && //this is about how high fleas can jump with  capMaxY = 0.12 + 0.04 * Math.random()
                                this.position.y - mob[i].position.y > -300 && //not too far below the flea (note that fleas should be on the ground most of the time when doing this check)
                                Matter.Query.ray(map, this.position, mob[i].position).length === 0 &&
                                Matter.Query.ray(body, this.position, mob[i].position).length === 0
                            ) {
                                const TARGET_VECTOR = Vector.sub(this.position, mob[i].position)
                                const DIST = Vector.magnitude(TARGET_VECTOR);
                                if (DIST < closeDist) {
                                    closeDist = DIST;
                                    this.lockedOn = mob[i]
                                }
                            }
                            const TARGET_VECTOR2 = Vector.sub(this.position, player.position)
                            const DIST = Vector.magnitude(TARGET_VECTOR2);
                            if (DIST < closeDist) {
                                closeDist = DIST;
                                this.lockedOn = player
                            }
                        }
                        if (remotePlayers[id].tech.isSporeFollow && !this.lockedOn && Matter.Query.ray(map, this.position, remotePlayers[id].pos).length === 0) {
                            this.lockedOn = { //make target player if there are no mobs to target
                                position: remotePlayers[id].pos,
                                velocity: { x: 0, y: 0 }
                            }
                        }
                        if (this.lockedOn) { //hop towards mob target
                            const where = Vector.add(this.lockedOn.position, Vector.mult(this.lockedOn.velocity, 5)) //estimate where the mob will be in 5 cycles
                            const Dy = Math.max(0, this.position.y - where.y) //can't be negative because you can't hop down
                            const Dx = this.position.x - where.x
                            const Vx = -0.06 * Dx / Math.sqrt(2 * Dy / this.gravity) //calibrated to hit target, don't mess with this
                            const Vy = 0.085 * Math.sqrt(this.gravity * Dy) //calibrated to hit target, don't mess with this
                            const capX = 0.07 + 0.02 * remotePlayers[id].tech.isSporeFollow
                            const capMaxY = 0.12 + 0.04 * Math.random() + 0.05 * remotePlayers[id].tech.isSporeFollow
                            const capMinY = closeDist > 500 ? 0.05 + 0.02 * Math.random() : 0.02 + 0.01 * Math.random() //don't jump super low, unless you are very close to mob target
                            this.force.x = Math.max(-capX, Math.min(capX, Vx)) * this.mass;
                            this.force.y = -Math.max(capMinY, Math.min(capMaxY, Vy)) * this.mass
                        } else { //random hops  
                            if (Math.random() < 0.5) { //chance to continue in the same horizontal direction
                                this.force.x = (0.01 + 0.03 * Math.random()) * this.mass * (this.velocity.x > 0 ? 1 : -1); //random move 
                            } else {
                                this.force.x = (0.01 + 0.03 * Math.random()) * this.mass * (Math.random() < 0.5 ? 1 : -1); //random move 
                            }
                            this.force.y = -(0.03 + 0.08 * Math.random()) * this.mass
                        }
                        Matter.Body.setVelocity(this, { x: 0, y: 0 });
                        this.setDamage() //after jumping damage is no longer zero
                    }
                }
            })
            Composite.add(engine.world, bullet[em]); //add bullet to world
            Matter.Body.setVelocity(bullet[em], velocity);
            if (remotePlayers[id].tech.isMutualism && remotePlayers[id].health > 0.05) {
                remotePlayers[id].health -= 0.01
                bullet[bullet.length - 1].isMutualismActive = true
            }
        }
        window.b2.worm = function(where, isFreeze, id) { //used with the tech upgrade in mob.death()
            const bIndex = bullet.length;
            const wormSize = 6 + remotePlayers[id].tech.wormSize * 4.2 * Math.random()
            if (bIndex < 500) { //can't make over 500 spores
                bullet[bIndex] = Bodies.polygon(where.x, where.y, 3, 3, {
                    inertia: Infinity,
                    isFreeze: isFreeze,
                    restitution: 0.5,
                    // angle: Math.random() * 2 * Math.PI,
                    friction: 0,
                    frictionAir: 0.025,
                    thrust: (remotePlayers[id].tech.isSporeFollow ? 0.0012 : 0.00055) * (1 + 0.5 * (Math.random() - 0.5)),
                    wormSize: wormSize,
                    wormTail: 1 + Math.max(4, Math.min(wormSize - 2 * remotePlayers[id].tech.wormSize, 30)),
                    dmg: (remotePlayers[id].tech.isMutualism ? 9.5 : 3.2) * wormSize,
                    lookFrequency: 100 + Math.floor(37 * Math.random()),
                    classType: "bullet",
                    collisionFilter: {
                        group: -id,
                        category: cat.body,
                        mask: cat.map | cat.mob | cat.mobBullet | cat.mobShield | cat.player //no collide with body
                    },
                    endCycle: simulation.cycle + Math.floor((600 + Math.floor(Math.random() * 420)) * remotePlayers[id].tech.bulletsLastLonger),
                    minDmgSpeed: 0,
                    playerOffPosition: { //used when moving towards player to keep spores separate
                        x: 100 * (Math.random() - 0.5),
                        y: 100 * (Math.random() - 0.5)
                    },
                    beforeDmg(who) {
                        if (who.isInvulnerable) {
                            Matter.Body.setVelocity(this, Vector.mult(this.velocity, 0.1));
                        } else {
                            if (remotePlayers[id].tech.isSpawnBulletsOnDeath && who.alive && who.isDropPowerUp) {
                                setTimeout(() => {
                                    if (!who.alive) {
                                        for (let i = 0; i < 3; i++) { //spawn 3 more
                                            b2.worm(this.position, remotePlayers[id].tech.isSporeFreeze, id)
                                            bullet[bullet.length - 1].endCycle = Math.min(simulation.cycle + Math.floor(420 * remotePlayers[id].tech.bulletsLastLonger), this.endCycle + 180 + Math.floor(60 * Math.random())) //simulation.cycle + Math.floor(420 * remotePlayers[id].tech.bulletsLastLonger)
                                        }
                                    }
                                    this.endCycle = 0; //bullet ends cycle after doing damage 
                                }, 1);
                            } else {
                                this.endCycle = 0; //bullet ends cycle after doing damage 
                            }
                            if (this.isFreeze) mobs.statusSlow(who, 90)
                        }
                    },
                    onEnd() {
                        if (remotePlayers[id].tech.isMutualism && this.isMutualismActive && !remotePlayers[id].tech.isEnergyHealth) {
                            remotePlayers[id].health += 0.02
                            if (remotePlayers[id].health > remotePlayers[id].maxHealth) remotePlayers[id].health = remotePlayers[id].maxHealth;
                            remotePlayers[id].displayHealth();
                        }
                    },
                    tailCycle: 6.28 * Math.random(),
                    do() {
                        this.tailCycle += this.speed * 0.025
                        ctx.beginPath(); //draw nematode
                        ctx.moveTo(this.position.x, this.position.y);
                        // const dir = Vector.mult(Vector.normalise(this.velocity), -Math.min(100, this.wormTail * this.speed))
                        const speed = Math.min(7, this.speed)
                        const dir = Vector.mult(Vector.normalise(this.velocity), -0.6 * this.wormTail * speed)
                        const tail = Vector.add(this.position, dir)
                        const wiggle = Vector.add(Vector.add(tail, dir), Vector.rotate(dir, Math.sin(this.tailCycle)))
                        // const wiggle = Vector.add(tail, Vector.rotate(dir, Math.sin((remotePlayers[id].cycle - this.endCycle) * 0.03 * this.speed)))
                        ctx.quadraticCurveTo(tail.x, tail.y, wiggle.x, wiggle.y) // ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, this.vertices[0].x, this.vertices[0].y)
                        // ctx.lineTo(tail.x, tail.y);
                        ctx.lineWidth = this.wormSize;
                        ctx.strokeStyle = "#000";
                        ctx.stroke();

                        if (this.lockedOn && this.lockedOn.alive) {
                            this.force = Vector.mult(Vector.normalise(Vector.sub(this.lockedOn.position, this.position)), this.mass * this.thrust)
                        } else {
                            if (!(simulation.cycle % this.lookFrequency)) { //find mob targets
                                this.closestTarget = null;
                                this.lockedOn = null;
                                let closeDist = Infinity;
                                for (let i = 0, len = mob.length; i < len; ++i) {
                                    if (mob[i].id != id && !mob[i].isBadTarget && Matter.Query.ray(map, this.position, mob[i].position).length === 0 && !mob[i].isInvulnerable) {
                                        const targetVector = Vector.sub(this.position, mob[i].position)
                                        const dist = Vector.magnitude(targetVector) * (Math.random() + 0.5);
                                        if (dist < closeDist) {
                                            this.closestTarget = mob[i].position;
                                            closeDist = dist;
                                            this.lockedOn = mob[i]
                                            if (0.3 > Math.random()) break //doesn't always target the closest mob
                                        }
                                    }
                                }
                                const targetVector2 = Vector.sub(this.position, player.position)
                                const dist2 = Vector.magnitude(targetVector2) * (Math.random() + 0.5);
                                if (dist2 < closeDist) {
                                    this.closestTarget = player.position;
                                    closeDist = dist2;
                                    this.lockedOn = player
                                }
                            }
                            if (remotePlayers[id].tech.isSporeFollow && this.lockedOn === null) { //move towards player //checking for null means that the spores don't go after the player until it has looked and not found a target
                                const dx = this.position.x - remotePlayers[id].pos.x;
                                const dy = this.position.y - remotePlayers[id].pos.y;
                                if (dx * dx + dy * dy > 10000) {
                                    this.force = Vector.mult(Vector.normalise(Vector.sub(remotePlayers[id].pos, Vector.add(this.playerOffPosition, this.position))), this.mass * this.thrust)
                                }
                            } else {
                                const unit = Vector.normalise(this.velocity)
                                const force = Vector.mult(Vector.rotate(unit, 0.005 * this.playerOffPosition.x), 0.000003)
                                this.force.x += force.x
                                this.force.y += force.y
                            }
                        }
                    },
                });
                const SPEED = 2 + 1 * Math.random();
                const ANGLE = 2 * Math.PI * Math.random()
                Matter.Body.setVelocity(bullet[bIndex], {
                    x: SPEED * Math.cos(ANGLE),
                    y: SPEED * Math.sin(ANGLE)
                });
                Composite.add(engine.world, bullet[bIndex]); //add bullet to world
                if (remotePlayers[id].tech.isMutualism && remotePlayers[id].health > 0.5) {
                    remotePlayers[id].health -= 0.02
                    bullet[bIndex].isMutualismActive = true
                }
            }
        }
        function sha256(str) {
            let hash = 2166136261;
            for (let i = 0; i < str.length; i++) {
                hash ^= str.charCodeAt(i);
                hash = (hash * 16777619) >>> 0;
            }
            return hash.toString();
        }
        function deterministicBlockId(area, vertices, levelSeed, levelId) {
            const str = `${area},${JSON.stringify(vertices)},${levelSeed}${levelId}`;
            return sha256(str);
        }
        spawn.bodyRect = function (x, y, width, height, chance = 1, properties = { friction: 0.05, frictionAir: 0.001 }) {
            if (Math.random() < chance) {
                body[body.length] = Bodies.rectangle(x + width / 2, y + height / 2, width, height, properties)
                const who = body[body.length - 1]
                const id = deterministicBlockId(who.area, who.vertices.length, Math.seed, level.onLevel);
                who.id = id;
                who.remoteBlock = false
                who._lastBlockUpdate = 0
                who.collisionFilter.category = cat.body
                who.collisionFilter.mask = cat.player | cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet
                Composite.add(engine.world, who)
                who.classType = "body"
                sendBlockCreate(who)
            }
        }
        spawn.bodyVertex = function (x, y, vector, properties) {
            body[body.length] = Matter.Bodies.fromVertices(x, y, Vertices.fromPath(vector), properties)
            const who = body[body.length - 1]
            const id = deterministicBlockId(who.area, who.vertices.length, Math.seed, level.onLevel);
            who.id = id;
            who.remoteBlock = false
            who._lastBlockUpdate = 0
            who.collisionFilter.category = cat.body
            who.collisionFilter.mask = cat.player | cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet
            Composite.add(engine.world, who)
            who.classType = "body"
            sendBlockCreate(who)
        }
        function removeLocalBlock(block) {
            if (!block) return
            if (!block.remoteBlock && typeof block.id === 'number') sendBlockRemove(block.id)
            Composite.remove(engine.world, block)
            const idx = body.indexOf(block)
            if (idx !== -1) body.splice(idx, 1)
            knownBlocks.delete(block.id)
        }
		function spawnPlayer(xPos, yPos, id) {
			mobs.spawn(0, 0, 6, 20, "transparent");
			let me = mob[mob.length - 1];
			Composite.remove(engine.world, me);

			let vertices = Vertices.fromPath(
				"0,40, 50,40, 50,115, 30,130, 20,130, 0,115, 0,40"
			);
			let mobBody = Bodies.fromVertices(xPos, yPos, vertices, {
				collisionFilter: {
					category: cat.mob,
					mask: cat.player | cat.map | cat.body | cat.bullet | cat.mob,
				},
                alive: true,
			});
			let jumpSensor = Bodies.rectangle(xPos, yPos + 46, 36, 6, {
				sleepThreshold: 99999999999,
				isSensor: true,
				collisionFilter: {
					category: cat.mob,
					mask: cat.player | cat.map | cat.body | cat.bullet | cat.mob,
				},
                alive: true,
			});
			vertices = Vertices.fromPath("16 -82 2 -66 2 -37 43 -37 43 -66 30 -82");
			let mobHead = Bodies.fromVertices(xPos, yPos - 55, vertices, {
				collisionFilter: {
					category: cat.mob,
					mask: cat.player | cat.map | cat.body | cat.bullet | cat.mob,
				},
			});
			let headSensor = Bodies.rectangle(xPos, yPos - 57, 48, 45, {
				sleepThreshold: 99999999999,
				isSensor: true,
				collisionFilter: {
					category: cat.mob,
					mask: cat.player | cat.map | cat.body | cat.bullet | cat.mob,
				},
                alive: true,
			});
			Body.setParts(me, [mobBody, mobHead, jumpSensor, headSensor]);
			me.id = id;
            me.username = "unnamed player";
			me.inertia = Infinity;
            me.mob = true;
			me.friction = 0.002;
			me.frictionAir = 0.001;
			me.restitution = 0;
			me.stroke = "transparent";
			me.showHealthBar = false;
			me.sleepThreshold = Infinity;
			me.collisionFilter.category = cat.mob;
			me.collisionFilter.mask = cat.player | cat.map | cat.body | cat.bullet | cat.mob;
            me.collisionFilter.group = -id;
			me.Fx = 0.016;
			me.fxAir = 0.016;
			me.jumpForce = 0.42;
			me.setMovement = function () {
				me.Fx = me.tech.baseFx * m.fieldFx * m.squirrelFx * (me.tech.isFastTime ? 1.5 : 1) / me.mass
				me.jumpForce = me.tech.baseJumpForce * m.fieldJump * m.squirrelJump * (tech.isFastTime ? 1.13 : 1) / me.mass / me.mass
			};
			me.airSpeedLimit = 125;
			me.onGround = false;
			me.lastOnGroundCycle = 0;
			me.coyoteCycles = 5;
			me.hardLanding = 130;
			me.numTouching = 0;
			me.crouch = false;
			me.yOff = 70;
			me.yOffGoal = 70;
			me.standingOn = undefined;
			me.pos = {
				x: 0,
				y: 0,
			};
			me.eyeFillColor = null;
			me.fillColor = null;
			me.fillColorDark = null;
			me.bodyGradient = null;
			me.color = {
				hue: 0,
				sat: 0,
				light: 100,
			};
			me.immuneCycle = 0;
			me.cycle = 0;
			me.setFillColors = function () {
				me.fillColor = `hsl(${me.color.hue},${me.color.sat}%,${me.color.light}%)`;
				me.fillColorDark = `hsl(${me.color.hue},${me.color.sat}%,${me.color.light - 25}%)`;
				let grd = ctx.createLinearGradient(-30, 0, 30, 0);
				grd.addColorStop(0, me.fillColorDark);
				grd.addColorStop(1, me.fillColor);
				me.bodyGradient = grd;
			};
			me.angle2 = 0;
			me.buttonCD_jump = 0;
			me.walk_cycle = 0;
			me.stepSize = 0;
			me.flipLegs = -1;
			me.hip = {
				x: 12,
				y: 24,
			};
			me.knee = {
				x: 0,
				y: 0,
				x2: 0,
				y2: 0,
			};
			me.foot = {
				x: 0,
				y: 0,
			};
			me.legLength1 = 55;
			me.legLength2 = 45;
			me.height = 42;
			me.yOffWhen = {
				crouch: 22,
				stand: 49,
				jump: 70,
			};
            me.tech = {
                fireRate: 1, //initializes to 1
                bulletSize: null,
                energySiphon: null,
                healSpawn: null,
                crouchAmmoCount: null,
                bulletsLastLonger: null,
                isImmortal: null,
                sporesOnDeath: null,
                isImmuneExplosion: null,
                isExplodeMob: null,
                isDroneOnDamage: null,
                isAcidDmg: null,
                isAnnihilation: null,
                largerHeals: null,
                isCrit: null,
                isLowHealthDmg: null,
                isLowHealthDefense: null,
                isLowHealthFireRate: null,
                isFarAwayDmg: null,
                isFirstDer: null,
                isMassEnergy: null,
                extraChoices: null,
                laserBotCount: null,
                dynamoBotCount: null,
                nailBotCount: null,
                foamBotCount: null,
                soundBotCount: null,
                boomBotCount: null,
                plasmaBotCount: null,
                missileBotCount: null,
                orbitBotCount: null,
                blockDmg: null,
                isBlockRadiation: null,
                isPiezo: null,
                isFastDrones: null,
                oneSuperBall: null,
                laserReflections: null,
                laserDamage: null,
                isAmmoFromHealth: null,
                mobSpawnWithHealth: null,
                isEnergyRecovery: null,
                isHealthRecovery: null,
                isEnergyLoss: null,
                isDeathAvoid: null,
                isDeathAvoidedThisLevel: null,
                isPlasmaRange: null,
                isFreezeMobs: null,
                isIceCrystals: null,
                blockDamage: null,
                isBlockStun: null,
                isStunField: null,
                isHarmDamage: null,
                isVacuumBomb: null,
                renormalization: null,
                fragments: null,
                energyDamage: null,
                botSpawner: null,
                isBotSpawnerReset: null,
                isSporeFollow: null,
                isNailRadiation: null,
                isEnergyHealth: null,
                isStun: null,
                restDamage: null,
                isRPG: null,
                missileCount: null,
                isDeterminism: null,
                isSuperDeterminism: null,
                isHarmReduce: null,
                nailsDeathMob: null,
                isSlowFPS: null,
                isNeutronStun: null,
                isAnsatz: null,
                isDamageFromBulletCount: null,
                laserDrain: null,
                isNailShot: null,
                slowFire: null,
                fastTime: null,
                isFastRadiation: null,
                isAmmoForGun: null,
                isRapidPulse: null,
                isSporeFreeze: null,
                isShotgunRecoil: null,
                isHealLowHealth: null,
                isAoESlow: null,
                isHarmArmor: null,
                isTurret: null,
                isRerollDamage: null,
                isHarmFreeze: null,
                isBotArmor: null,
                isRerollHaste: null,
                researchHaste: null,
                isMineDrop: null,
                isRerollBots: null,
                isNailBotUpgrade: null,
                isFoamBotUpgrade: null,
                isSoundBotUpgrade: null,
                isLaserBotUpgrade: null,
                isBoomBotUpgrade: null,
                isOrbitBotUpgrade: null,
                isDroneGrab: null,
                isOneGun: null,
                isDamageForGuns: null,
                isGunCycle: null,
                isFastFoam: null,
                isSporeGrowth: null,
                isStimulatedEmission: null,
                // nailGun: null,
                nailInstantFireRate: null,
                isCapacitor: null,
                isEnergyNoAmmo: null,
                // isFreezeHarmImmune: null,
                isSmallExplosion: null,
                isExplosionHarm: null,
                extraMaxHealth: null,
                // bonusHealth: null,
                isIntangible: null,
                isCloakStun: null,
                bonusEnergy: null,
                // healGiveMaxEnergy: null,
                healMaxEnergyBonus: 0, //not null
                slowFireDamage: null,
                isNoFireDefense: null,
                isNoFireDamage: null,
                duplicateChance: null,
                beamSplitter: null,
                iceEnergy: null,
                isPerfectBrake: null,
                explosiveRadius: null,
                // isWormholeEnergy: null,
                isWormholeDamage: null,
                isNailCrit: null,
                isFlechetteExplode: null,
                isWormholeWorms: null,
                isWormHoleBullets: null,
                isWideLaser: null,
                wideLaser: null,
                isPulseLaser: null,
                isRadioactive: null,
                radioactiveDamage: null,
                isRailEnergy: null,
                isMineSentry: null,
                isIncendiary: null,
                overfillDrain: null,
                isNeutronSlow: null,
                // isRailAreaDamage: null,
                historyLaser: null,
                isSpeedHarm: null,
                isSpeedDamage: null,
                speedAdded: null,
                isTimeSkip: null,
                isCancelDuplication: null,
                duplication: null,
                isCancelRerolls: null,
                isCancelTech: null,
                cancelTechCount: null,
                isBotDamage: null,
                isBanish: null,
                isRetain: null,
                isMaxEnergyTech: null,
                isLowEnergyDamage: null,
                isRewindBot: null,
                isRewindGrenade: null,
                isExtruder: null,
                isEndLevelPowerUp: null,
                isMissileBig: null,
                isMissileBiggest: null,
                isMissileFast: null,
                isMissile2ndExplode: null,
                isLaserMine: null,
                isFoamMine: null,
                isAmmoFoamSize: null,
                isIceIX: null,
                isDupDamage: null,
                isDupEnergy: null,
                isFireRateForGuns: null,
                cyclicImmunity: null,
                isTechDamage: null,
                isRestHarm: null,
                isFireMoveLock: null,
                isRivets: null,
                isNeedles: null,
                isExplodeRadio: null,
                isPauseSwitchField: null,
                isPauseEjectTech: null,
                pauseEjectTech: null,
                isShieldPierce: null,
                isDuplicateMobs: null,
                isDynamoBotUpgrade: null,
                isBlockPowerUps: null,
                isHarmReduceNoKill: null,
                isSwitchReality: null,
                isResearchReality: null,
                isAnthropicDamage: null,
                isMetaAnalysis: null,
                isFoamAttract: null,
                droneCycleReduction: null,
                droneEnergyReduction: null,
                isHalfHeals: null,
                isAlwaysFire: null,
                isDroneRespawn: null,
                deathSpawns: null,
                isMobBlockFling: null,
                isPhaseVelocity: null,
                waveBeamSpeed: null,
                wavePacketAmplitude: null,
                isCollisionRealitySwitch: null,
                iceIXOnDeath: null,
                wimpCount: null,
                isAddBlockMass: null,
                isDarkMatter: null,
                isHarmDarkMatter: null,
                isMoveDarkMatter: null,
                isNotDarkMatter: null,
                isSneakAttack: null,
                isFallingDamage: null,
                harmonics: null,
                isStandingWaveExpand: null,
                isTokamak: null,
                isTokamakHeal: null,
                tokamakHealCount: null,
                isTokamakFly: null,
                deflectEnergy: null,
                superBallDelay: null,
                isBlockExplode: null,
                isOverHeal: null,
                isDroneRadioactive: null,
                droneRadioDamage: null,
                isDroneTeleport: null,
                isDroneFastLook: null,
                isBulletTeleport: null,
                isJunkResearch: null,
                laserColor: null,
                laserColorAlpha: null,
                isLongitudinal: null,
                is360Longitudinal: null,
                isShotgunReversed: null,
                fieldDuplicate: null,
                isCloakingDamage: null,
                harmonicEnergy: null,
                isFieldHarmReduction: null,
                isFastTime: null,
                isAnthropicTech: null,
                isSporeWorm: null,
                isSporeFlea: null,
                isFoamShot: null,
                isIceShot: null,
                isBlockRestitution: null,
                isZeno: null,
                isFieldFree: null,
                isExtraGunField: null,
                isBigField: null,
                isSmartRadius: null,
                isFilament: null,
                isLargeHarpoon: null,
                extraHarpoons: null,
                ammoCap: null,
                isHarpoonPowerUp: null,
                harpoonDensity: null,
                isAddRemoveMaxHealth: null,
                cloakDuplication: null,
                extruderRange: null,
                isForeverDrones: null,
                nailRecoil: null,
                baseJumpForce: null,
                baseFx: null,
                isNeutronium: null,
                isFreeWormHole: null,
                isCrouchRegen: null,
                isAxion: null,
                isDarkEnergy: null,
                isDarkStar: null,
                isWormholeMapIgnore: null,
                isLessDamageReduction: null,
                needleTunnel: null,
                isBrainstorm: null,
                isBrainstormActive: null,
                brainStormDelay: null,
                wormSize: null,
                extraSuperBalls: null,
                isTimeCrystals: null,
                isGroundState: null,
                isRailGun: null,
                isDronesTravel: null,
                isTechDebt: null,
                isPlasmaBall: null,
                plasmaDischarge: null,
                missileFireCD: null,
                isBotField: null,
                isFoamBall: null,
                isNoDraftPause: null,
                isFoamPressure: null,
                foamDamage: null,
                isClusterExplode: null,
                isCircleExplode: null,
                isPetalsExplode: null,
                isVerlet: null,
                isIceMaxHealthLoss: null,
                isIceKill: null,
                isCritKill: null,
                isQuantumEraser: null,
                isPhononBlock: null,
                isPhononWave: null,
                isLaserLens: null,
                laserCrit: null,
                isSporeColony: null,
                isExtraBotOption: null,
                isLastHitDamage: null,
                isCloakHealLastHit: null,
                isRicochet: null,
                isCancelCouple: null,
                isCouplingPowerUps: null,
                isBoostPowerUps: null,
                isBoostReplaceAmmo: null,
                isInfiniteWaveAmmo: null,
                isJunkDNA: null,
                buffedGun: 0,
                isGunChoice: null,
                railChargeRate: null,
                isSuperHarm: null,
                isZombieMobs: null,
                isSuperMine: null,
                sentryAmmo: null,
                collidePowerUps: null,
                isDilate: null,
                isDiaphragm: null,
                isOffGroundDamage: null,
                isSuperBounce: null,
                isDivisor: null,
                isFoamCavitation: null,
                isHealAttract: null,
                isLaserField: null,
                isHealBrake: null,
                isMassProduction: null,
                isPrinter: null,
                isHookDefense: null,
                hookNails: null,
                isHarpoonDefense: null,
                isReel: null,
                harpoonPowerUpCycle: null,
                isHarpoonFullHealth: null,
                isMobFullHealthCloak: null,
                isMobLowHealth: null,
                isDamageCooldown: null,
                isDamageCooldownTime: null,
                isPowerUpDamage: null,
                isExitPrompt: null,
                isResearchDamage: null,
                isResearchHeal: null,
                interestRate: null,
                isImmunityDamage: null,
                isMobDeathImmunity: null,
                isMaxHealthDefense: null,
                noDefenseSettingDamage: null,
                isMaxHealthDamage: null,
                isEjectOld: null,
                isWiki: null,
                isStaticBlock: null,
                isDamageFieldTech: null,
                isRemineralize: null,
                mineralDamageReduction: null,
                isDemineralize: null,
                mineralDamage: null,
                negativeMassCost: null,
                beamCollimator: null,
                isInPilot: null,
                isNoPilotCost: null,
                isPlasmaBoost: null,
                isControlPlasma: null,
                energyDefense: null,
                isNewWormHoleDamage: null,
                isNoDeath: null,
                isDeathTech: null,
                isDeathTechTriggered: null,
                isRebar: null,
                isMaul: null,
                isTargeting: null,
                isBreakHarpoon: null,
                isBreakHarpoonGain: null,
                isExponential: null,
                isCoyote: null,
                isNitinol: null,
                isEndothermic: null,
                isPrecision: null,
            };
			me.onGroundCheck = function (event) {
				function enter() {
					me.numTouching++;
					if (!me.onGround) {
						me.onGround = true;
						if (me.crouch) {
							if (me.checkHeadClear()) {
								me.undoCrouch();
							} else {
								me.yOffGoal = me.yOffWhen.crouch;
							}
						} else {
							const momentum = player.velocity.y * player.mass;
							if (momentum > me.hardLanding) {
								me.doCrouch();
								me.yOff = me.yOffWhen.jump;
								me.hardLandCD =
									me.cycle +
									me.hardLandCDScale * Math.min(momentum / 6.5 - 6, 40);
								if (
									tech.isFallingDamage &&
									me.immuneCycle < me.cycle &&
									momentum > 150
								) {
									me.damage(Math.min(Math.sqrt(momentum - 133) * 0.01, 0.25));
									if (me.immuneCycle < me.cycle + me.collisionImmuneCycles)
										me.immuneCycle = me.cycle + me.collisionImmuneCycles;
								}
							} else {
								me.yOffGoal = me.yOffWhen.stand;
							}
						}
					}
				}
				const pairs = event.pairs;
				for (let i = 0, j = pairs.length; i != j; ++i) {
					let pair = pairs[i];
					if (pair.bodyA === jumpSensor) {
						me.standingOn = pair.bodyB;
						if (me.standingOn.alive !== true || me.immuneCycle > me.cycle)
							enter();
					} else if (pair.bodyB === jumpSensor) {
						me.standingOn = pair.bodyA;
						if (me.standingOn.alive !== true || me.immuneCycle > me.cycle)
							enter();
					}
				}
				me.numTouching = 0;
			};
			me.offGroundCheck = function (event) {
				const pairs = event.pairs;
				for (let i = 0, j = pairs.length; i != j; ++i) {
					if (pairs[i].bodyA === jumpSensor || pairs[i].bodyB === jumpSensor) {
						if (me.onGround && me.numTouching === 0) {
							me.onGround = false;
							me.lastOnGroundCycle = me.cycle;
							me.hardLandCD = 0;
							if (me.checkHeadClear()) {
								if (me.crouch) {
									me.undoCrouch();
								}
								me.yOffGoal = me.yOffWhen.jump;
							}
						}
					}
				}
			};
			me.checkHeadClear = function () {
				if (Matter.Query.collides(headSensor, map).length > 0) {
					return false;
				} else {
					return true;
				}
			};
			me.collisionChecks = function (event) {
				const pairs = event.pairs;
				for (let i = 0, j = pairs.length; i != j; i++) {
					if (me.alive) {
						let bodyA = pairs[i].bodyA;
						let bodyB = pairs[i].bodyB;

						if (bodyA === me || bodyA === mobBody || bodyA === mobHead) {
							collideMob(pairs[i].bodyB);
						} else if (bodyB === me || bodyB === mobBody || bodyB === mobHead) {
							collideMob(pairs[i].bodyA);
						}

						function collideMob(obj) {
							if (obj.classType === "bullet" && obj.speed > obj.minDmgSpeed && !obj.remoteBullet) {
								obj.beforeDmg(me);
								let dmg =
									(obj.dmg +
										0.15 *
										obj.mass *
										Vector.magnitude(Vector.sub(me.velocity, obj.velocity)));
								if (tech.isCrit && me.isStunned) dmg *= 4;
								me.damage(dmg);
								if (me.alive) me.foundPlayer();
								if (me.damageReduction) {
									simulation.drawList.push({
										x: pairs[i].activeContacts[0].vertex.x,
										y: pairs[i].activeContacts[0].vertex.y,
										radius: Math.log(dmg + 1.1) * 40 * me.damageReduction + 3,
										color: simulation.playerDmgColor,
										time: simulation.drawTime,
									});
								}
								if (tech.isLessDamageReduction && !me.shield)
									me.damageReduction *= me.isBoss ?
									me.isFinalBoss ?
									1.0005 :
									1.0025 :
									1.05;
								return;
							}

							if (obj.classType === "body" && obj.speed > 6) {
								const v = Vector.magnitude(
									Vector.sub(me.velocity, obj.velocity)
								);
								if (v > 9) {
									if (tech.blockDmg) {

										Matter.Body.setVelocity(me, {
											x: 0.5 * me.velocity.x,
											y: 0.5 * me.velocity.y,
										});
										if (
											tech.isBlockRadiation &&
											!me.isShielded &&
											!me.isMobBullet
										) {
											mobs.statusDoT(me, tech.blockDmg * 0.42, 180);
										} else {
											me.damage(tech.blockDmg);
											simulation.drawList.push({
												x: pairs[i].activeContacts[0].vertex.x,
												y: pairs[i].activeContacts[0].vertex.y,
												radius: 28 * me.damageReduction + 3,
												color: "rgba(255,0,255,0.8)",
												time: 4,
											});
										}
									}

									let dmg =
										tech.blockDamage *
										v *
										obj.mass *
										(tech.isMobBlockFling ? 2.5 : 1) *
										(tech.isBlockRestitution ? 2.5 : 1) *
										(m.fieldMode === 0 || m.fieldMode === 8 ?
											1 + 0.05 * m.coupling :
											1);
									if (me.isShielded) dmg *= 0.7;

									me.damage(dmg, true);
									if (
										tech.isBlockPowerUps &&
										!me.alive &&
										me.isDropPowerUp &&
										Math.random() < 0.5
									) {
										options = ["coupling", "boost", "heal", "research"];
										if (!tech.isEnergyNoAmmo) options.push("ammo");
										powerUps.spawn(
											me.position.x,
											me.position.y,
											options[Math.floor(Math.random() * options.length)]
										);
									}

									const stunTime = dmg / Math.sqrt(obj.mass);
									if (stunTime > 0.5 && me.memory !== Infinity)
										mobs.statusStun(me, 60 + 60 * Math.sqrt(stunTime));
									if (
										me.alive &&
										me.distanceToPlayer2() < 1000000 &&
										!m.isCloak
									)
										me.foundPlayer();
									if (tech.fragments && obj.speed > 10 && !obj.hasFragmented) {
										obj.hasFragmented = true;
										b.targetedNail(obj.position, tech.fragments * 4);
									}
									if (me.damageReduction) {
										simulation.drawList.push({
											x: pairs[i].activeContacts[0].vertex.x,
											y: pairs[i].activeContacts[0].vertex.y,
											radius: Math.log(dmg + 1.1) * 40 * me.damageReduction + 3,
											color: simulation.playerDmgColor,
											time: simulation.drawTime,
										});
									}
									return;
								}
							}
						}
					}
				}
			};
			Matter.Body.setMass(me, m.mass);
			Composite.add(engine.world, me);
			me.drawLeg = function (stroke) {};
			me.calcLeg = function (cycle_offset, offset) {
				me.hip.x = 12 + offset;
				me.hip.y = 24 + offset;
				me.stepSize =
					0.8 * me.stepSize +
					0.2 * (7 * Math.sqrt(Math.min(9, Math.abs(me.Vx))) * me.onGround);
				const stepAngle = 0.034 * me.walk_cycle + cycle_offset;
				me.foot.x = 2.2 * me.stepSize * Math.cos(stepAngle) + offset;
				me.foot.y =
					offset +
					1.2 * me.stepSize * Math.sin(stepAngle) +
					me.yOff +
					me.height;
				const Ymax = me.yOff + me.height;
				if (me.foot.y > Ymax) me.foot.y = Ymax;
				const d = Math.sqrt(
					(me.hip.x - me.foot.x) * (me.hip.x - me.foot.x) +
					(me.hip.y - me.foot.y) * (me.hip.y - me.foot.y)
				);
				const l =
					(me.legLength1 * me.legLength1 -
						me.legLength2 * me.legLength2 +
						d * d) /
					(2 * d);
				const h = Math.sqrt(me.legLength1 * me.legLength1 - l * l);
				me.knee.x =
					(l / d) * (me.foot.x - me.hip.x) -
					(h / d) * (me.foot.y - me.hip.y) +
					me.hip.x +
					offset;
				me.knee.y =
					(l / d) * (me.foot.y - me.hip.y) +
					(h / d) * (me.foot.x - me.hip.x) +
					me.hip.y;
			};
			me.draw = function () {};
			me.resetSkin = function () {
				me.hardLandCDScale = 1;
				me.yOffWhen.jump = 70;
				me.yOffWhen.stand = 49;
				me.yOffWhen.crouch = 22;
				me.isAltSkin = false;
				me.coyoteCycles = 5;
				me.hardLanding = 130;
				me.squirrelFx = 1;
				me.squirrelJump = 1;
				me.velocitySmooth = {
					x: 0,
					y: 0
				};
				requestAnimationFrame(() => {
					me.setMovement();
				});
				me.color = {
					hue: 0,
					sat: 0,
					light: 100,
				};
				me.setFillColors();
				me.draw = function () {
					ctx.fillStyle = me.fillColor;
					me.walk_cycle += me.flipLegs * me.Vx;
					ctx.save();
					ctx.globalAlpha = me.immuneCycle < me.cycle ? 1 : 0.5;
					ctx.translate(me.pos.x, me.pos.y);
					me.calcLeg(Math.PI, -3);
					me.drawLeg("#4a4a4a");
					me.calcLeg(0, 0);
					me.drawLeg("#333");
					ctx.rotate(me.angle2);
					ctx.beginPath();
					ctx.arc(0, 0, 30, 0, 2 * Math.PI);
					ctx.fillStyle = me.bodyGradient;
					ctx.fill();
					ctx.arc(15, 0, 4, 0, 2 * Math.PI);
					ctx.strokeStyle = "#333";
					ctx.lineWidth = 2;
					ctx.stroke();
					ctx.restore();
					me.yOff = me.yOff * 0.85 + me.yOffGoal * 0.15;
				};
				me.drawLeg = function (stroke) {
					if (me.angle2 > -Math.PI / 2 && me.angle2 < Math.PI / 2) {
						me.flipLegs = 1;
					} else {
						me.flipLegs = -1;
					}
					ctx.save();
					ctx.scale(me.flipLegs, 1);
					ctx.beginPath();
					ctx.moveTo(me.hip.x, me.hip.y);
					ctx.lineTo(me.knee.x, me.knee.y);
					ctx.lineTo(me.foot.x, me.foot.y);
					ctx.strokeStyle = stroke;
					ctx.lineWidth = 5;
					ctx.stroke();
					ctx.beginPath();
					ctx.moveTo(me.foot.x, me.foot.y);
					if (me.onGround) {
						ctx.lineTo(me.foot.x - 14, me.foot.y + 5);
						ctx.moveTo(me.foot.x, me.foot.y);
						ctx.lineTo(me.foot.x + 14, me.foot.y + 5);
					} else {
						ctx.lineTo(me.foot.x - 12, me.foot.y + 8);
						ctx.moveTo(me.foot.x, me.foot.y);
						ctx.lineTo(me.foot.x + 12, me.foot.y + 8);
					}
					ctx.lineWidth = 4;
					ctx.stroke();
					ctx.beginPath();
					ctx.arc(me.hip.x, me.hip.y, 9, 0, 2 * Math.PI);
					ctx.moveTo(me.knee.x + 5, me.knee.y);
					ctx.arc(me.knee.x, me.knee.y, 5, 0, 2 * Math.PI);
					ctx.moveTo(me.foot.x + 4, me.foot.y + 1);
					ctx.arc(me.foot.x, me.foot.y + 1, 4, 0, 2 * Math.PI);
					ctx.fillStyle = me.fillColor;
					ctx.fill();
					ctx.lineWidth = 2;
					ctx.stroke();
					ctx.restore();
				};
			};
			Events.on(engine, "collisionStart", function (event) {
				me.onGroundCheck(event);

				me.collisionChecks(event);
			});
			Events.on(engine, "collisionActive", function (event) {
				me.onGroundCheck(event);
			});
			Events.on(engine, "collisionEnd", function (event) {
				me.offGroundCheck(event);
			});
			me.resetSkin();
			me.jump = function () {
				me.buttonCD_jump = me.cycle;
				me.force.y = -me.jumpForce;
			};
			me.doCrouch = function () {
				if (!me.crouch) {
					me.crouch = true;
					me.yOffGoal = me.yOffWhen.crouch;
					if (mobHead.position.y - me.position.y < 0) {
						Matter.Body.setPosition(mobHead, {
							x: me.position.x,
							y: me.position.y + 9.1740767,
						});
					}
				}
			};
			me.undoCrouch = function () {
				if (me.crouch) {
					me.crouch = false;
					me.yOffGoal = me.yOffWhen.stand;
					if (mobHead.position.y - me.position.y > 0) {
						Matter.Body.setPosition(mobHead, {
							x: me.position.x,
							y: me.position.y - 30.28592321,
						});
					}
				}
			};
			me.groundControl = function () {
                const originalInputDown = me.inputDown;
				if (!me.checkHeadClear()) {
					me.inputDown = true;
				} else {
					me.inputDown = originalInputDown;
				}
                if (me.crouch) {
                    if (!me.inputDown && me.checkHeadClear() && me.hardLandCD < me.cycle) me.undoCrouch();
                } else if (me.inputDown || me.hardLandCD > me.cycle) {
                    me.doCrouch();
                } else if (me.inputUp && me.buttonCD_jump + 20 < me.cycle) {
                    me.jump();
                }
                if (me.inputLeft) {
                    me.force.x -= me.Fx;
                } else if (me.inputRight) {
                    me.force.x += me.Fx;
                } else {
                    const stoppingFriction = 0.92;
                    Matter.Body.setVelocity(me, { x: me.velocity.x * stoppingFriction, y: me.velocity.y * stoppingFriction });
                }
                if (me.speed > 4) { //come to a stop if fast 
                    const stoppingFriction = (me.crouch) ? 0.65 : 0.89; // this controls speed when crouched
                    Matter.Body.setVelocity(me, { x: me.velocity.x * stoppingFriction, y: me.velocity.y * stoppingFriction });
                }
			};
			me.airControl = function () {
                if (me.inputUp && me.buttonCD_jump + 20 < me.cycle && me.lastOnGroundCycle + me.coyoteCycles > me.cycle) {
                    me.jump();
                }
                if (me.buttonCD_jump + 60 > me.cycle && !me.inputUp && me.Vy < 0) {
                    Matter.Body.setVelocity(me, { x: me.velocity.x, y: me.velocity.y * 0.94 });
                }
                if (me.inputLeft) {
                    if (me.velocity.x > -me.airSpeedLimit / me.mass / me.mass) me.force.x -= me.fxAir;
                } else if (me.inputRight) {
                    if (me.velocity.x < me.airSpeedLimit / me.mass / me.mass) me.force.x += me.fxAir;
                }
			};
            me.muzzleFlash = (radius = 30) => {
                simulation.drawList.push({ //add dmg to draw queue
                    x: me.pos.x + 20 * Math.cos(me.angle2),
                    y: me.pos.y + 20 * Math.sin(me.angle2),
                    radius: radius,
                    color: "#fb0",
                    time: 1
                });
            }
            me.baseFire = (angle, speed = 30 + 6 * Math.random()) => {
                b2.nail({
                    x: me.pos.x + 30 * Math.cos(me.angle2),
                    y: me.pos.y + 30 * Math.sin(me.angle2)
                }, {
                    x: 0.8 * me.velocity.x + speed * Math.cos(angle),
                    y: 0.5 * me.velocity.y + speed * Math.sin(angle)
                }, me.id) 
                if (me.tech.isIceCrystals) {
                    bullet[bullet.length - 1].beforeDmg = function (who) {
                        mobs.statusSlow(who, 120)
                        if (me.tech.isNailRadiation) mobs.statusDoT(who, 1 * (me.tech.isFastRadiation ? 1.3 : 0.44), me.tech.isSlowRadiation ? 360 : (me.tech.isFastRadiation ? 60 : 180)) // one tick every 30 cycles
                        if (me.tech.isNailCrit) {
                            if (!who.shield && Vector.dot(Vector.normalise(Vector.sub(who.position, this.position)), Vector.normalise(this.velocity)) > 0.97 - 1 / who.radius) {
                                b.explosion(this.position, 150 + 30 * Math.random());
                            }
                        }
                        this.ricochet(who)
                    };
                    if (me.energy < 0.01) {
                        me.fireCDcycle = me.cycle + 60;
                    } else {
                        me.energy -= 0.005
                    }
                }
            }
            me.history = [];
            me.ammo = 17;
            me.mouse = {
                x: 0,
                y: 0
            }
            me.nextFireCycle = 0;
            me.startingHoldCycle = 0;
            me.fireCDcycle = 0;
            me.fireCDscale = 1;
            me.wavePacketCycle = 0;
            me.delay = 40;
            me.phononWaveCD = 0;
            me.waves = [];
            me.charge = 0,
            me.isStuckOn = false;
            me.angle3 = 0;
            me.isInsideArc = (angle) => {
                const mod = (a, n) => {
                    return a - Math.floor(a / n) * n
                }
                let diff = mod(angle - me.angle3 + Math.PI, 2 * Math.PI) - Math.PI
                return Math.abs(diff) < me.arcRange
            },
            me.arcRange = 0.78; //1.57,
            me.lensDamage = 1;
            me.lensDamageOn = 0; //set in tech
            me.lens = () => {
                me.stuckOn();
                me.angle3 += 0.03
                if (me.isInsideArc(me.angle)) {
                    me.lensDamage = me.lensDamageOn
                    ctx.lineWidth = 6 + me.lensDamageOn
                } else {
                    me.lensDamage = 1
                    ctx.lineWidth = 2
                }
                ctx.beginPath();
                ctx.arc(m.pos.x, m.pos.y, 60, me.angle3 - me.arcRange, me.angle3 + me.arcRange);
                ctx.strokeStyle = '#fff' //'rgba(255,255,255,0.9)' //'hsl(189, 100%, 95%)'
                ctx.stroke();
            };
            me.stuckOn = () => {
                if (me.tech.isStuckOn) {
                    if (me.isStuckOn) {
                        if (!me.inputFire) me.fire();
                        if (m.energy < tech.laserDrain + 0.06) this.isStuckOn = false
                    } else if (input.fire) {
                        this.isStuckOn = true
                    }
                }
            },
            me.setGrenadeMode = () => {
                grenadeDefault = function (where = {
                    x: me.pos.x + 30 * Math.cos(me.angle2),
                    y: me.pos.y + 30 * Math.sin(me.angle2)
                }, angle = me.angle2, size = 1) {
                    const em = bullet.length;
                    bullet[em] = Bodies.circle(where.x, where.y, 15, b2.fireAttributes(angle, false, me.id));
                    Matter.Body.setDensity(bullet[em], 0.0003);
                    bullet[em].explodeRad = 300 * size + 100 * me.tech.isBlockExplode;
                    bullet[em].onEnd = me.grenadeEnd
                    bullet[em].minDmgSpeed = 1;
                    bullet[em].beforeDmg = function () {
                        this.endCycle = 0; //bullet ends cycle after doing damage  //this also triggers explosion
                    };
                    speed = me.crouch ? 43 : 32
                    Matter.Body.setVelocity(bullet[em], {
                        x: 0.5 * me.velocity.x + speed * Math.cos(angle),
                        y: 0.5 * me.velocity.y + speed * Math.sin(angle)
                    });
                    bullet[em].endCycle = simulation.cycle + Math.floor(me.crouch ? 120 : 80) * me.tech.bulletsLastLonger;
                    bullet[em].restitution = 0.4;
                    bullet[em].do = function () {
                        const collisions = Matter.Query.collides(this, [player]);
                        if (collisions.length > 0) {
                            this.beforeDmg();
                        }
                        this.force.y += this.mass * 0.0025; //extra gravity for harder arcs
                    };
                    Composite.add(engine.world, bullet[em]); //add bullet to world
                    if (me.tech.isPrecision) {
                        bullet[em].do = function () {
                            this.force.y += this.mass * 0.0025; //extra gravity for harder arcs
                            //check if above mob
                            for (let i = 0; i < mob.length; i++) {
                                if (
                                    !mob[i].isBadTarget &&
                                    !mob[i].isInvulnerable &&
                                    this.position.y < mob[i].bounds.min.y &&
                                    this.position.x > mob[i].position.x - mob[i].radius / 2 &&
                                    this.position.x < mob[i].position.x + mob[i].radius / 2 &&
                                    Matter.Query.ray(map, this.position, mob[i].position).length === 0 &&
                                    Matter.Query.ray(body, this.position, mob[i].position).length === 0
                                ) {
                                    Matter.Body.setVelocity(this, { x: 0, y: 4 + Math.max(10, this.speed) });
                                    this.do = function () {
                                        this.force.y += this.mass * 0.003;
                                    }
                                    ctx.strokeStyle = "#000"
                                    ctx.lineWidth = 3
                                    ctx.beginPath()
                                    ctx.moveTo(this.position.x, this.position.y)
                                    ctx.lineTo(mob[i].position.x, mob[i].position.y)
                                    ctx.stroke()
                                }
                            }
                        };
                    }
                }
                grenadeRPG = function (where = {
                    x: me.pos.x + 30 * Math.cos(me.angle2),
                    y: me.pos.y + 30 * Math.sin(me.angle2)
                }, angle = me.angle2, size = 1) {
                    const em = bullet.length;
                    bullet[em] = Bodies.circle(where.x, where.y, 15, b2.fireAttributes(angle, false, me.id));
                    Matter.Body.setDensity(bullet[em], 0.0003);
                    bullet[em].explodeRad = 300 * size + 100 * me.tech.isBlockExplode;
                    bullet[em].onEnd = me.grenadeEnd
                    bullet[em].minDmgSpeed = 1;
                    bullet[em].beforeDmg = function () {
                        this.endCycle = 0; //bullet ends cycle after doing damage  //this also triggers explosion
                    };
                    speed = me.crouch ? 46 : 32
                    Matter.Body.setVelocity(bullet[em], {
                        x: 0.8 * me.velocity.x + speed * Math.cos(angle),
                        y: 0.5 * me.velocity.y + speed * Math.sin(angle)
                    });
                    Composite.add(engine.world, bullet[em]); //add bullet to world

                    bullet[em].endCycle = simulation.cycle + 70 * me.tech.bulletsLastLonger;
                    bullet[em].frictionAir = 0.07;
                    const MAG = 0.015
                    bullet[em].thrust = {
                        x: bullet[em].mass * MAG * Math.cos(angle),
                        y: bullet[em].mass * MAG * Math.sin(angle)
                    }
                    bullet[em].do = function () {
                        const collisions = Matter.Query.collides(this, [player]);
                        if (collisions.length > 0) {
                            this.beforeDmg();
                        }
                        this.force.x += this.thrust.x;
                        this.force.y += this.thrust.y;
                        if (Matter.Query.collides(this, map).length || Matter.Query.collides(this, body).length) {
                            this.endCycle = 0; //explode if touching map or blocks
                        }
                    };
                    if (me.tech.isPrecision) {
                        bullet[em].do = function () {
                            this.force.x += this.thrust.x;
                            this.force.y += this.thrust.y;
                            if (Matter.Query.collides(this, map).length || Matter.Query.collides(this, body).length) {
                                this.endCycle = 0; //explode if touching map or blocks
                            }
                            //check if above mob
                            for (let i = 0; i < mob.length; i++) {
                                if (
                                    !mob[i].isBadTarget &&
                                    !mob[i].isInvulnerable &&
                                    this.position.y < mob[i].bounds.min.y &&
                                    this.position.x > mob[i].position.x - mob[i].radius / 2 &&
                                    this.position.x < mob[i].position.x + mob[i].radius / 2 &&
                                    Matter.Query.ray(map, this.position, mob[i].position).length === 0 &&
                                    Matter.Query.ray(body, this.position, mob[i].position).length === 0
                                ) {
                                    Matter.Body.setVelocity(this, { x: 0, y: 4 + Math.max(10, this.speed) });
                                    this.frictionAir = 0
                                    this.do = function () {
                                        this.force.y += this.mass * 0.003;
                                    }
                                    ctx.strokeStyle = "#000"
                                    ctx.lineWidth = 3
                                    ctx.beginPath()
                                    ctx.moveTo(this.position.x, this.position.y)
                                    ctx.lineTo(mob[i].position.x, mob[i].position.y)
                                    ctx.stroke()
                                }
                            }
                        };
                    }
                }
                grenadeRPGVacuum = function (where = {
                    x: me.pos.x + 30 * Math.cos(me.angle2),
                    y: me.pos.y + 30 * Math.sin(me.angle2)
                }, angle = me.angle2, size = 1) {
                    const em = bullet.length;
                    bullet[em] = Bodies.circle(where.x, where.y, 15, b2.fireAttributes(angle, false, me.id));
                    Matter.Body.setDensity(bullet[em], 0.0003);
                    bullet[em].explodeRad = 350 * size + Math.floor(Math.random() * 50) + me.tech.isBlockExplode * 100
                    bullet[em].onEnd = me.grenadeEnd
                    bullet[em].minDmgSpeed = 1;
                    bullet[em].beforeDmg = function () {
                        Matter.Body.setVelocity(this, { x: 0, y: 0 }); //keep bomb in place
                        this.endCycle = 0; //bullet ends cycle after doing damage  //this also triggers explosion
                        // if (this.endCycle > simulation.cycle + this.suckCycles) this.endCycle = simulation.cycle + this.suckCycles
                    };
                    speed = me.crouch ? 46 : 32
                    Matter.Body.setVelocity(bullet[em], {
                        x: 0.8 * me.velocity.x + speed * Math.cos(angle),
                        y: 0.5 * me.velocity.y + speed * Math.sin(angle)
                    });
                    Composite.add(engine.world, bullet[em]); //add bullet to world
                    bullet[em].endCycle = simulation.cycle + 70 * me.tech.bulletsLastLonger;
                    bullet[em].frictionAir = 0.07;
                    bullet[em].suckCycles = 40
                    const MAG = 0.015
                    bullet[em].thrust = {
                        x: bullet[em].mass * MAG * Math.cos(angle),
                        y: bullet[em].mass * MAG * Math.sin(angle)
                    }
                    bullet[em].suck = function () {
                        const suck = (who, radius = this.explodeRad * 3.2) => {
                            for (i = 0, len = who.length; i < len; i++) {
                                const sub = Vector.sub(this.position, who[i].position);
                                const dist = Vector.magnitude(sub);
                                if (dist < radius && dist > 150 && !who.isInvulnerable && who[i] !== this) {
                                    knock = Vector.mult(Vector.normalise(sub), mag * who[i].mass / Math.sqrt(dist));
                                    who[i].force.x += knock.x;
                                    who[i].force.y += knock.y;
                                }
                            }
                        }
                        let mag = 0.1
                        if (simulation.cycle > this.endCycle - 5) {
                            mag = -0.22
                            suck(mob, this.explodeRad * 3)
                            suck(body, this.explodeRad * 2)
                            suck(powerUp, this.explodeRad * 1.5)
                            suck(bullet, this.explodeRad * 1.5)
                            suck([me], this.explodeRad * 1.3)
                        } else {
                            mag = 0.11
                            suck(mob, this.explodeRad * 3)
                            suck(body, this.explodeRad * 2)
                            suck(powerUp, this.explodeRad * 1.5)
                            suck(bullet, this.explodeRad * 1.5)
                            suck([me], this.explodeRad * 1.3)
                        }

                        Matter.Body.setVelocity(this, { x: 0, y: 0 }); //keep bomb in place
                        //draw suck
                        const radius = 2.75 * this.explodeRad * (this.endCycle - simulation.cycle) / this.suckCycles
                        ctx.fillStyle = "rgba(0,0,0,0.1)";
                        ctx.beginPath();
                        ctx.arc(this.position.x, this.position.y, radius, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                    bullet[em].do = function () {
                        const collisions = Matter.Query.collides(this, [player]);
                        if (collisions.length > 0) {
                            this.beforeDmg();
                        }
                        if (simulation.cycle > this.endCycle - this.suckCycles) { //suck
                            this.do = this.suck
                        } else if (Matter.Query.collides(this, map).length || Matter.Query.collides(this, body).length) {
                            Matter.Body.setPosition(this, Vector.sub(this.position, this.velocity)) //undo last movement
                            this.do = this.suck
                        } else {
                            this.force.x += this.thrust.x;
                            this.force.y += this.thrust.y;
                        }
                    };
                    if (me.tech.isPrecision) {
                        bullet[em].do = function () {
                            if (simulation.cycle > this.endCycle - this.suckCycles) { //suck
                                this.do = this.suck
                            } else if (Matter.Query.collides(this, map).length || Matter.Query.collides(this, body).length) {
                                Matter.Body.setPosition(this, Vector.sub(this.position, this.velocity)) //undo last movement
                                this.do = this.suck
                            } else {
                                this.force.x += this.thrust.x;
                                this.force.y += this.thrust.y;
                            }
                            //check if above mob
                            for (let i = 0; i < mob.length; i++) {
                                if (
                                    !mob[i].isBadTarget &&
                                    !mob[i].isInvulnerable &&
                                    this.position.y < mob[i].bounds.min.y &&
                                    this.position.x > mob[i].position.x - mob[i].radius / 2 &&
                                    this.position.x < mob[i].position.x + mob[i].radius / 2 &&
                                    Matter.Query.ray(map, this.position, mob[i].position).length === 0 &&
                                    Matter.Query.ray(body, this.position, mob[i].position).length === 0
                                ) {
                                    Matter.Body.setVelocity(this, { x: 0, y: 4 + Math.max(10, this.speed) });
                                    this.frictionAir = 0
                                    this.do = function () {
                                        if (simulation.cycle > this.endCycle - this.suckCycles) { //suck
                                            this.do = this.suck
                                        } else if (Matter.Query.collides(this, map).length || Matter.Query.collides(this, body).length) {
                                            Matter.Body.setPosition(this, Vector.sub(this.position, this.velocity)) //undo last movement
                                            this.do = this.suck
                                        }
                                    }
                                    ctx.strokeStyle = "#000"
                                    ctx.lineWidth = 3
                                    ctx.beginPath()
                                    ctx.moveTo(this.position.x, this.position.y)
                                    ctx.lineTo(mob[i].position.x, mob[i].position.y)
                                    ctx.stroke()
                                }
                            }
                        };
                    }
                }
                grenadeVacuum = function (where = {
                    x: me.pos.x + 30 * Math.cos(me.angle2),
                    y: me.pos.y + 30 * Math.sin(me.angle2)
                }, angle = me.angle2, size = 1) {
                    const suckCycles = 40
                    const em = bullet.length;
                    bullet[em] = Bodies.circle(where.x, where.y, 20, b2.fireAttributes(angle, false, me.id));
                    Matter.Body.setDensity(bullet[em], 0.0002);
                    bullet[em].explodeRad = 350 * size + Math.floor(Math.random() * 50) + me.tech.isBlockExplode * 100
                    bullet[em].onEnd = me.grenadeEnd
                    bullet[em].beforeDmg = function () {
                        Matter.Body.setVelocity(this, { x: 0, y: 0 });
                        this.endCycle = 0; //bullet ends cycle after doing damage  //this also triggers explosion
                        // if (this.endCycle > simulation.cycle + suckCycles) this.endCycle = simulation.cycle + suckCycles
                    };
                    bullet[em].restitution = 0.4;
                    bullet[em].do = function () {
                        const collisions = Matter.Query.collides(this, [player]);
                        if (collisions.length > 0) {
                            this.beforeDmg();
                        }
                        this.force.y += this.mass * 0.0025; //extra gravity for harder arcs

                        if (simulation.cycle > this.endCycle - suckCycles) { //suck
                            const that = this

                            function suck(who, radius = that.explodeRad * 3.2) {
                                for (i = 0, len = who.length; i < len; i++) {
                                    const sub = Vector.sub(that.position, who[i].position);
                                    const dist = Vector.magnitude(sub);
                                    if (dist < radius && dist > 150 && !who.isInvulnerable) {
                                        knock = Vector.mult(Vector.normalise(sub), mag * who[i].mass / Math.sqrt(dist));
                                        who[i].force.x += knock.x;
                                        who[i].force.y += knock.y;
                                    }
                                }
                            }
                            let mag = 0.1
                            if (simulation.cycle > this.endCycle - 5) {
                                mag = -0.22
                                suck(mob, this.explodeRad * 3)
                                suck(body, this.explodeRad * 2)
                                suck(powerUp, this.explodeRad * 1.5)
                                suck(bullet, this.explodeRad * 1.5)
                                suck([me], this.explodeRad * 1.3)
                            } else {
                                mag = 0.11
                                suck(mob, this.explodeRad * 3)
                                suck(body, this.explodeRad * 2)
                                suck(powerUp, this.explodeRad * 1.5)
                                suck(bullet, this.explodeRad * 1.5)
                                suck([me], this.explodeRad * 1.3)
                            }
                            //keep bomb in place
                            Matter.Body.setVelocity(this, { x: 0, y: 0 });
                            //draw suck
                            const radius = 2.75 * this.explodeRad * (this.endCycle - simulation.cycle) / suckCycles
                            ctx.fillStyle = "rgba(0,0,0,0.1)";
                            ctx.beginPath();
                            ctx.arc(this.position.x, this.position.y, radius, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    };
                    speed = 35
                    // speed = me.crouch ? 43 : 32

                    bullet[em].endCycle = simulation.cycle + 70 * me.tech.bulletsLastLonger;
                    if (me.crouch) {
                        speed += 9
                        bullet[em].endCycle += 20;
                    }
                    Matter.Body.setVelocity(bullet[em], {
                        x: 0.5 * me.velocity.x + speed * Math.cos(angle),
                        y: 0.5 * me.velocity.y + speed * Math.sin(angle)
                    });
                    Composite.add(engine.world, bullet[em]); //add bullet to world
                    if (me.tech.isPrecision) {
                        bullet[em].do = function () {
                            this.force.y += this.mass * 0.0025; //extra gravity for harder arcs

                            const suckCycles = 40
                            if (simulation.cycle > this.endCycle - suckCycles) { //suck
                                const that = this

                                function suck(who, radius = that.explodeRad * 3.2) {
                                    for (i = 0, len = who.length; i < len; i++) {
                                        const sub = Vector.sub(that.position, who[i].position);
                                        const dist = Vector.magnitude(sub);
                                        if (dist < radius && dist > 150 && !who.isInvulnerable) {
                                            knock = Vector.mult(Vector.normalise(sub), mag * who[i].mass / Math.sqrt(dist));
                                            who[i].force.x += knock.x;
                                            who[i].force.y += knock.y;
                                        }
                                    }
                                }
                                let mag = 0.1
                                if (simulation.cycle > this.endCycle - 5) {
                                    mag = -0.22
                                    suck(mob, this.explodeRad * 3)
                                    suck(body, this.explodeRad * 2)
                                    suck(powerUp, this.explodeRad * 1.5)
                                    suck(bullet, this.explodeRad * 1.5)
                                    suck([me], this.explodeRad * 1.3)
                                } else {
                                    mag = 0.11
                                    suck(mob, this.explodeRad * 3)
                                    suck(body, this.explodeRad * 2)
                                    suck(powerUp, this.explodeRad * 1.5)
                                    suck(bullet, this.explodeRad * 1.5)
                                    suck([me], this.explodeRad * 1.3)
                                }
                                //keep bomb in place
                                Matter.Body.setVelocity(this, { x: 0, y: 0 });
                                //draw suck
                                const radius = 2.75 * this.explodeRad * (this.endCycle - simulation.cycle) / suckCycles
                                ctx.fillStyle = "rgba(0,0,0,0.1)";
                                ctx.beginPath();
                                ctx.arc(this.position.x, this.position.y, radius, 0, 2 * Math.PI);
                                ctx.fill();
                            }
                            //check if above mob
                            for (let i = 0; i < mob.length; i++) {
                                if (
                                    !mob[i].isBadTarget &&
                                    !mob[i].isInvulnerable &&
                                    this.position.y < mob[i].bounds.min.y &&
                                    this.position.x > mob[i].position.x - mob[i].radius / 2 &&
                                    this.position.x < mob[i].position.x + mob[i].radius / 2 &&
                                    Matter.Query.ray(map, this.position, mob[i].position).length === 0 &&
                                    Matter.Query.ray(body, this.position, mob[i].position).length === 0
                                ) {
                                    Matter.Body.setVelocity(this, { x: 0, y: 4 + Math.max(10, this.speed) });

                                    this.do = function () {
                                        this.force.y += this.mass * 0.0025; //extra gravity for harder arcs

                                        const suckCycles = 40
                                        if (simulation.cycle > this.endCycle - suckCycles) { //suck
                                            const that = this

                                            function suck(who, radius = that.explodeRad * 3.2) {
                                                for (i = 0, len = who.length; i < len; i++) {
                                                    const sub = Vector.sub(that.position, who[i].position);
                                                    const dist = Vector.magnitude(sub);
                                                    if (dist < radius && dist > 150 && !who.isInvulnerable) {
                                                        knock = Vector.mult(Vector.normalise(sub), mag * who[i].mass / Math.sqrt(dist));
                                                        who[i].force.x += knock.x;
                                                        who[i].force.y += knock.y;
                                                    }
                                                }
                                            }
                                            let mag = 0.1
                                            if (simulation.cycle > this.endCycle - 5) {
                                                mag = -0.22
                                                suck(mob, this.explodeRad * 3)
                                                suck(body, this.explodeRad * 2)
                                                suck(powerUp, this.explodeRad * 1.5)
                                                suck(bullet, this.explodeRad * 1.5)
                                                suck([me], this.explodeRad * 1.3)
                                            } else {
                                                mag = 0.11
                                                suck(mob, this.explodeRad * 3)
                                                suck(body, this.explodeRad * 2)
                                                suck(powerUp, this.explodeRad * 1.5)
                                                suck(bullet, this.explodeRad * 1.5)
                                                suck([me], this.explodeRad * 1.3)
                                            }
                                            //keep bomb in place
                                            Matter.Body.setVelocity(this, { x: 0, y: 0 });
                                            //draw suck
                                            const radius = 2.75 * this.explodeRad * (this.endCycle - simulation.cycle) / suckCycles
                                            ctx.fillStyle = "rgba(0,0,0,0.1)";
                                            ctx.beginPath();
                                            ctx.arc(this.position.x, this.position.y, radius, 0, 2 * Math.PI);
                                            ctx.fill();
                                        }
                                    }
                                    ctx.strokeStyle = "#000"
                                    ctx.lineWidth = 3
                                    ctx.beginPath()
                                    ctx.moveTo(this.position.x, this.position.y)
                                    ctx.lineTo(mob[i].position.x, mob[i].position.y)
                                    ctx.stroke()
                                }
                            }
                        };
                    }
                }
                grenadeNeutron = function (where = { x: me.pos.x + 30 * Math.cos(me.angle2), y: me.pos.y + 30 * Math.sin(me.angle2) }, angle = me.angle2, size = 1) {
                    const em = bullet.length;
                    bullet[em] = Bodies.polygon(where.x, where.y, 10, 4, b2.fireAttributes(angle, false, me.id));
                    b2.fireProps((me.crouch ? 45 : 25) / Math.pow(0.92, me.tech.missileCount), me.crouch ? 35 : 20, angle, me); //cd , speed
                    Matter.Body.setDensity(bullet[em], 0.000001);
                    bullet[em].endCycle = 500 + simulation.cycle;
                    bullet[em].frictionAir = 0;
                    bullet[em].friction = 1;
                    bullet[em].frictionStatic = 1;
                    bullet[em].restitution = 0;
                    bullet[em].minDmgSpeed = 0;
                    bullet[em].damageRadius = 100;
                    bullet[em].maxDamageRadius = 450 * size + 130 * me.tech.isNeutronSlow //+ 150 * Math.random()
                    bullet[em].radiusDecay = (0.81 + 0.15 * me.tech.isNeutronSlow) / me.tech.bulletsLastLonger
                    bullet[em].stuckTo = null;
                    bullet[em].stuckToRelativePosition = null;
                    if (me.tech.isRPG) {
                        const SCALE = 2
                        Matter.Body.scale(bullet[em], SCALE, SCALE);
                        speed = me.crouch ? 25 : 15
                        // speed = me.crouch ? 43 : 32
                        Matter.Body.setVelocity(bullet[em], { x: 0.5 * me.velocity.x + speed * Math.cos(angle), y: 0.5 * me.velocity.y + speed * Math.sin(angle) });
                        const MAG = 0.005
                        bullet[em].thrust = { x: bullet[em].mass * MAG * Math.cos(angle), y: bullet[em].mass * MAG * Math.sin(angle) }
                    }

                    bullet[em].beforeDmg = function () { };
                    bullet[em].stuck = function () { };
                    let isPrecisionTriggered = false
                    bullet[em].do = function () {
                        const collisions = Matter.Query.collides(this, [player]);
                        if (collisions.length > 0) {
                            this.beforeDmg();
                        }
                        const onCollide = () => {
                            this.collisionFilter.mask = 0; //non collide with everything
                            Matter.Body.setVelocity(this, { x: 0, y: 0 });
                            if (me.tech.isRPG) this.thrust = { x: 0, y: 0 }
                            this.do = this.radiationMode;
                        }
                        const mobCollisions = Matter.Query.collides(this, [...mob, player])
                        if (mobCollisions.length) {
                            onCollide()
                            this.stuckTo = mobCollisions[0].bodyA
                            mobs.statusDoT(this.stuckTo, 0.6, 360) //apply radiation damage status effect on direct hits
                            if (this.stuckTo.isVerticesChange) {
                                this.stuckToRelativePosition = { x: 0, y: 0 }
                            } else {
                                //find the relative position for when the mob is at angle zero by undoing the mobs rotation
                                this.stuckToRelativePosition = Vector.rotate(Vector.sub(this.position, this.stuckTo.position), -this.stuckTo.angle)
                            }
                            this.stuck = function () {
                                if (this.stuckTo && this.stuckTo.alive) {
                                    const rotate = Vector.rotate(this.stuckToRelativePosition, this.stuckTo.angle) //add in the mob's new angle to the relative position vector
                                    Matter.Body.setPosition(this, Vector.add(Vector.add(rotate, this.stuckTo.velocity), this.stuckTo.position))
                                    Matter.Body.setVelocity(this, this.stuckTo.velocity); //so that it will move properly if it gets unstuck
                                } else {
                                    this.collisionFilter.mask = cat.map | cat.body | cat.me | cat.mob; //non collide with everything but map
                                    this.stuck = function () {
                                        this.force.y += this.mass * 0.001;
                                    }
                                }
                            }
                        } else {
                            const bodyCollisions = Matter.Query.collides(this, body)
                            if (bodyCollisions.length) {
                                if (!bodyCollisions[0].bodyA.isNotHoldable) {
                                    onCollide()
                                    this.stuckTo = bodyCollisions[0].bodyA
                                    //find the relative position for when the mob is at angle zero by undoing the mobs rotation
                                    this.stuckToRelativePosition = Vector.rotate(Vector.sub(this.position, this.stuckTo.position), -this.stuckTo.angle)
                                } else {
                                    this.do = this.radiationMode;
                                }
                                this.stuck = function () {
                                    if (this.stuckTo) {
                                        const rotate = Vector.rotate(this.stuckToRelativePosition, this.stuckTo.angle) //add in the mob's new angle to the relative position vector
                                        Matter.Body.setPosition(this, Vector.add(Vector.add(rotate, this.stuckTo.velocity), this.stuckTo.position))
                                        // Matter.Body.setVelocity(this, this.stuckTo.velocity); //so that it will move properly if it gets unstuck
                                    } else {
                                        this.force.y += this.mass * 0.001;
                                    }
                                }
                            } else {
                                if (Matter.Query.collides(this, map).length) {
                                    onCollide()
                                } else if (me.tech.isRPG) { //if colliding with nothing
                                    this.force.x += this.thrust.x;
                                    this.force.y += this.thrust.y;
                                } else {
                                    this.force.y += this.mass * 0.001;
                                }
                            }
                        }
                        if (me.tech.isPrecision && !isPrecisionTriggered) {
                            //check if above mob
                            for (let i = 0; i < mob.length; i++) {
                                if (
                                    !mob[i].isBadTarget &&
                                    !mob[i].isInvulnerable &&
                                    this.position.y < mob[i].bounds.min.y &&
                                    this.position.x > mob[i].position.x - mob[i].radius / 2 &&
                                    this.position.x < mob[i].position.x + mob[i].radius / 2 &&
                                    Matter.Query.ray(map, this.position, mob[i].position).length === 0 &&
                                    Matter.Query.ray(body, this.position, mob[i].position).length === 0
                                ) {
                                    Matter.Body.setVelocity(this, { x: 0, y: 4 + Math.max(10, this.speed) });
                                    // console.log()
                                    isPrecisionTriggered = true
                                    if (me.tech.isRPG) this.thrust = { x: 0, y: 0 }

                                    ctx.strokeStyle = "#000"
                                    ctx.lineWidth = 3
                                    ctx.beginPath()
                                    ctx.moveTo(this.position.x, this.position.y)
                                    ctx.lineTo(mob[i].position.x, mob[i].position.y)
                                    ctx.stroke()
                                }
                            }
                        }
                    }
                    bullet[em].radiationMode = function () { //the do code after the bullet is stuck on something,  projects a damaging radiation field
                        this.stuck(); //runs different code based on what the bullet is stuck to
                        this.damageRadius = this.damageRadius * 0.85 + 0.15 * this.maxDamageRadius //smooth radius towards max
                        this.maxDamageRadius -= this.radiusDecay
                        if (this.damageRadius < 15) {
                            this.endCycle = 0;
                        } else {
                            //aoe damage to me
                            if (Vector.magnitude(Vector.sub(me.position, this.position)) < this.damageRadius) {
                                const DRAIN = (me.tech.isRadioactiveResistance ? 0.0025 * 0.2 : 0.0025)
                                if (me.energy > DRAIN) {
                                    if (me.immuneCycle < me.cycle) me.energy -= DRAIN
                                } else {
                                    me.energy = 0;
                                    me.takeDamage((me.tech.isRadioactiveResistance ? 0.00016 * 0.2 : 0.00016) * me.tech.radioactiveDamage * spawn.dmgTomeByLevelsCleared()) //0.00015
                                }
                            }
                            //aoe damage to mobs
                            let dmg = 0.15 * me.tech.radioactiveDamage
                            for (let i = 0, len = mob.length; i < len; i++) {
                                if (Vector.magnitude(Vector.sub(mob[i].position, this.position)) < this.damageRadius + mob[i].radius) {
                                    if (Matter.Query.ray(map, mob[i].position, this.position).length > 0) dmg *= 0.2 //reduce damage if a wall is in the way
                                    mob[i].damage(mob[i].shield ? dmg * 3 : dmg);
                                    mob[i].locateme();
                                    if (me.tech.isNeutronSlow && mob[i].speed > 4) {
                                        Matter.Body.setVelocity(mob[i], { x: mob[i].velocity.x * 0.97, y: mob[i].velocity.y * 0.97 });
                                    }
                                }
                            }
                            ctx.beginPath();
                            ctx.arc(this.position.x, this.position.y, this.damageRadius, 0, 2 * Math.PI);
                            ctx.globalCompositeOperation = "lighter"
                            ctx.fillStyle = `rgba(25,139,170,${0.2 + 0.06 * Math.random()})`;
                            ctx.fill();
                            ctx.globalCompositeOperation = "source-over"
                            if (me.tech.isNeutronSlow) {
                                let slow = (who, radius = this.explodeRad * 3.2) => {
                                    for (i = 0, len = who.length; i < len; i++) {
                                        const sub = Vector.sub(this.position, who[i].position);
                                        const dist = Vector.magnitude(sub);
                                        if (dist < radius) {
                                            Matter.Body.setVelocity(who[i], { x: who[i].velocity.x * 0.975, y: who[i].velocity.y * 0.975 });
                                        }
                                    }
                                }
                                slow(body, this.damageRadius)
                                slow([me], this.damageRadius)
                            }
                        }
                    }
                }
                if (me.tech.isNeutronBomb) {
                    window.b2.grenade = grenadeNeutron
                    if (me.tech.isRPG) {
                        me.grenadeDo.do = function () { }
                    } else {
                        me.grenadeDo.do = function () {
                            // if (!me.inputField && me.crouch) {
                            //     const cycles = 80
                            //     const speed = me.crouch ? 35 : 20 //me.crouch ? 43 : 32
                            //     const g = me.crouch ? 0.137 : 0.135
                            //     const v = {
                            //         x: speed * Math.cos(me.angle2),
                            //         y: speed * Math.sin(me.angle2)
                            //     }
                            //     ctx.strokeStyle = "rgba(68, 68, 68, 0.2)" //color.map
                            //     ctx.lineWidth = 2
                            //     ctx.beginPath()
                            //     for (let i = 1, len = 19; i < len + 1; i++) {
                            //         const time = cycles * i / len
                            //         ctx.lineTo(me.pos.x + time * v.x, me.pos.y + time * v.y + g * time * time)
                            //     }
                            //     ctx.stroke()
                            // }
                        }
                    }
                } else if (me.tech.isRPG) {
                    me.grenadeDo.do = function () { }
                    if (me.tech.isVacuumBomb) {
                        window.b2.grenade = grenadeRPGVacuum
                    } else {
                        window.b2.grenade = grenadeRPG
                    }
                } else if (me.tech.isVacuumBomb) {
                    window.b2.grenade = grenadeVacuum
                    me.grenadeDo.do = function () {
                        // if (!me.inputField && me.crouch) {
                        //     const cycles = Math.floor(me.crouch ? 50 : 30) //30
                        //     const speed = me.crouch ? 44 : 35
                        //     const v = { x: speed * Math.cos(me.angle2), y: speed * Math.sin(me.angle2) }
                        //     ctx.strokeStyle = "rgba(68, 68, 68, 0.2)" //color.map
                        //     ctx.lineWidth = 2
                        //     ctx.beginPath()
                        //     for (let i = 1.6, len = 19; i < len + 1; i++) {
                        //         const time = cycles * i / len
                        //         ctx.lineTo(me.pos.x + time * v.x, me.pos.y + time * v.y + 0.34 * time * time)
                        //     }
                        //     ctx.stroke()
                        // }
                    }
                } else {
                    window.b2.grenade = grenadeDefault
                    me.grenadeDo.do = function () {
                        // if (!me.inputField && me.crouch) {
                        //     const cycles = Math.floor(me.crouch ? 120 : 80) //30
                        //     const speed = me.crouch ? 43 : 32
                        //     const v = { x: speed * Math.cos(me.angle2), y: speed * Math.sin(me.angle2) } //me.Vy / 2 + removed to make the path less jerky
                        //     ctx.strokeStyle = "rgba(68, 68, 68, 0.2)" //color.map
                        //     ctx.lineWidth = 2
                        //     ctx.beginPath()
                        //     for (let i = 0.5, len = 19; i < len + 1; i++) {
                        //         const time = cycles * i / len
                        //         ctx.lineTo(me.pos.x + time * v.x, me.pos.y + time * v.y + 0.34 * time * time)
                        //     }
                        //     ctx.stroke()
                        // }
                    }
                }
            }
            me.grenadeDo = {
                do() { }
            }
            me.grenadeEnd = function() {
                if (me.tech.isCircleExplode) {
                    b.starburst(this.position, this.explodeRad)
                } else if (me.tech.isPetalsExplode) {
                    b.fireFlower(this.position, this.explodeRad)
                } else if (me.tech.isClusterExplode) {
                    b.clusterExplode(this.position, this.explodeRad)
                } else {
                    b.explosion(this.position, this.explodeRad); //makes bullet do explosive damage at end
                }
                // if (me.tech.fragments) b.targetedNail(this.position, tech.fragments * Math.floor(2 + 1.5 * Math.random()))
            }
            me.isDischarge = false;
            me.knockBack = 0.0005;
            me.applyKnock = function(velocity) {
                me.force.x -= 0.7 * this.knockBack * velocity.x
                if (velocity.y > 0) {
                    me.force.y -= 4.3 * this.knockBack * velocity.y
                } else {
                    me.force.y -= this.knockBack * velocity.y
                }
            }
            if (!me.lastTextPos) me.lastTextPos = { x: me.position.x, y: me.pos.y - 70 };
            if (!me.crosshair) me.crosshair = { x: me.mouse.x, y: me.mouse.y };
            function lerp(a, b, t) {
                return a + (b - a) * t;
            }
            me.fieldRegen = 0.04;
            me.fieldCDcycle = 0;
            me.fieldMeterColor = "#0cf";
            me.minEnergyToDeflect = 0.05;
            me.fieldMode = 0;
            me.defaultMass = 5;
            me.resetHistory = function() {
                const set = {
                    position: {
                        x: me.position.x,
                        y: me.position.y,
                    },
                    velocity: {
                        x: me.velocity.x,
                        y: me.velocity.y
                    },
                    yOff: me.yOff,
                    angle: me.angle2,
                    health: me.health,
                    energy: me.energy,
                    activeGun: me.activeGun
                }
                for (let i = 0; i < 600; i++) { //reset history
                    m.history[i] = set
                }
            }
            me.drawRegenEnergy = function(bgColor = "rgba(0, 0, 0, 0.4)", range = 60) {
                if (me.energy < me.maxEnergy) {
                    me.regenEnergy();
                    ctx.fillStyle = bgColor;
                    const xOff = me.pos.x - me.radius * me.maxEnergy
                    const yOff = me.pos.y - 50
                    ctx.fillRect(xOff, yOff, range * me.maxEnergy, 10);
                    ctx.fillStyle = me.fieldMeterColor;
                    ctx.fillRect(xOff, yOff, range * me.energy, 10);
                } else if (me.energy > me.maxEnergy + 0.05) {
                    ctx.fillStyle = bgColor;
                    const xOff = me.pos.x - me.radius * me.energy
                    const yOff = me.pos.y - 50
                    // ctx.fillRect(xOff, yOff, range * me.maxEnergy, 10);
                    ctx.fillStyle = me.fieldMeterColor;
                    ctx.fillRect(xOff, yOff, range * me.energy, 10);
                }
            }
            me.drawHold = function(target, stroke = true) {
                if (target) {
                    const eye = 15;
                    const len = target.vertices.length - 1;
                    ctx.fillStyle = "rgba(110,170,200," + (0.2 + 0.4 * Math.random()) + ")";
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = "#000";
                    ctx.beginPath();
                    ctx.moveTo(
                        me.pos.x + eye * Math.cos(me.angle2),
                        me.pos.y + eye * Math.sin(me.angle2)
                    );
                    ctx.lineTo(target.vertices[len].x, target.vertices[len].y);
                    ctx.lineTo(target.vertices[0].x, target.vertices[0].y);
                    ctx.fill();
                    if (stroke) ctx.stroke();
                    for (let i = 0; i < len; i++) {
                        ctx.beginPath();
                        ctx.moveTo(
                            me.pos.x + eye * Math.cos(me.angle2),
                            me.pos.y + eye * Math.sin(me.angle2)
                        );
                        ctx.lineTo(target.vertices[i].x, target.vertices[i].y);
                        ctx.lineTo(target.vertices[i + 1].x, target.vertices[i + 1].y);
                        ctx.fill();
                        if (stroke) ctx.stroke();
                    }
                }
            }
            me.holding = function() {
                if (me.fireCDcycle < me.cycle) me.fireCDcycle = me.cycle - 1
                if (me.holdingTarget) {
                    me.energy -= me.fieldRegen;
                    if (me.energy < 0) me.energy = 0;
                    Matter.Body.setPosition(me.holdingTarget, {
                        x: me.pos.x + 70 * Math.cos(me.angle2),
                        y: me.pos.y + 70 * Math.sin(me.angle2)
                    });
                    Matter.Body.setVelocity(me.holdingTarget, me.velocity);
                    Matter.Body.rotate(me.holdingTarget, 0.01 / me.holdingTarget.mass); //gently spin the block
                } else {
                    me.isHolding = false
                }
            }
            me.throwBlockDefault = function() {
                if (me.holdingTarget) {
                    if (me.inputField) {
                        if (me.energy > 0.001) {
                            if (me.fireCDcycle < me.cycle) me.fireCDcycle = me.cycle
                            if (me.tech.isCapacitor && me.throwCharge < 4) me.throwCharge = 4
                            me.throwCharge += 0.5 / me.holdingTarget.mass / me.fireCDscale
                            if (me.throwCharge < 6) me.energy -= 0.001 / me.fireCDscale; // me.throwCharge caps at 5 

                            //trajectory path prediction
                            if (me.tech.isTokamak) {
                                //draw charge
                                const x = me.pos.x + 15 * Math.cos(me.angle2);
                                const y = me.pos.y + 15 * Math.sin(me.angle2);
                                const len = me.holdingTarget.vertices.length - 1;
                                const opacity = me.throwCharge > 4 ? 0.65 : me.throwCharge * 0.06
                                ctx.fillStyle = `rgba(255,0,255,${opacity})`;
                                ctx.beginPath();
                                ctx.moveTo(x, y);
                                ctx.lineTo(me.holdingTarget.vertices[len].x, me.holdingTarget.vertices[len].y);
                                ctx.lineTo(me.holdingTarget.vertices[0].x, me.holdingTarget.vertices[0].y);
                                ctx.fill();
                                for (let i = 0; i < len; i++) {
                                    ctx.beginPath();
                                    ctx.moveTo(x, y);
                                    ctx.lineTo(me.holdingTarget.vertices[i].x, me.holdingTarget.vertices[i].y);
                                    ctx.lineTo(me.holdingTarget.vertices[i + 1].x, me.holdingTarget.vertices[i + 1].y);
                                    ctx.fill();
                                }
                                if (me.tech.isTokamakFly && me.throwCharge > 4 && me.energy > 0.01) {
                                    me.force.y -= 0.5 * me.mass * simulation.g; //add some reduced gravity
                                    // const mass = (me.mass + 10) / 3 * simulation.g //this makes it so you fly slower with larger blocks
                                    let isDrain = false
                                    const thrust = me.mass * simulation.g * Math.pow(5 / me.mass, 0.1)
                                    if (me.inputDown) {
                                        isDrain = true
                                        me.force.y += 0.9 * thrust;
                                    } else if (me.inputUp) {
                                        isDrain = true
                                        me.force.y -= 0.9 * thrust
                                    }
                                    if (!me.onGround) {
                                        if (me.inputLeft) {
                                            isDrain = true
                                            me.force.x -= 0.4 * thrust
                                        } else if (me.inputRight) {
                                            isDrain = true
                                            me.force.x += 0.4 * thrust
                                        }
                                        if (isDrain) me.energy -= 0.0017;
                                    }

                                }
                            } else {
                                if (me.tech.isGroupThrow) {
                                    const range = 810000

                                    for (let i = 0; i < body.length; i++) {
                                        const sub = Vector.sub(me.pos, body[i].position)
                                        const dist2 = Vector.magnitudeSquared(sub)
                                        if (dist2 < range) {
                                            body[i].force.y -= body[i].mass * (simulation.g * 1.01); //remove a bit more then standard gravity
                                            if (dist2 > 40000) {
                                                const f = Vector.mult(Vector.normalise(sub), 0.0008 * body[i].mass)
                                                body[i].force.x += f.x
                                                body[i].force.y += f.y
                                                Matter.Body.setVelocity(body[i], { x: 0.96 * body[i].velocity.x, y: 0.96 * body[i].velocity.y });
                                            }
                                        }
                                    }
                                    ctx.beginPath();
                                    ctx.arc(me.pos.x, me.pos.y, Math.sqrt(range), 0, 2 * Math.PI);
                                    ctx.fillStyle = "rgba(245,245,255,0.15)";
                                    ctx.fill();
                                    // ctx.globalCompositeOperation = "difference";
                                    // ctx.globalCompositeOperation = "source-over";
                                }
                                //draw charge
                                const x = me.pos.x + 15 * Math.cos(me.angle2);
                                const y = me.pos.y + 15 * Math.sin(me.angle2);
                                const len = me.holdingTarget.vertices.length - 1;
                                const edge = me.throwCharge * me.throwCharge * me.throwCharge;
                                const grd = ctx.createRadialGradient(x, y, edge, x, y, edge + 5);
                                grd.addColorStop(0, "rgba(255,50,150,0.3)");
                                grd.addColorStop(1, "transparent");
                                ctx.fillStyle = grd;
                                ctx.beginPath();
                                ctx.moveTo(x, y);
                                ctx.lineTo(me.holdingTarget.vertices[len].x, me.holdingTarget.vertices[len].y);
                                ctx.lineTo(me.holdingTarget.vertices[0].x, me.holdingTarget.vertices[0].y);
                                ctx.fill();
                                for (let i = 0; i < len; i++) {
                                    ctx.beginPath();
                                    ctx.moveTo(x, y);
                                    ctx.lineTo(me.holdingTarget.vertices[i].x, me.holdingTarget.vertices[i].y);
                                    ctx.lineTo(me.holdingTarget.vertices[i + 1].x, me.holdingTarget.vertices[i + 1].y);
                                    ctx.fill();
                                }
                            }
                        } else {
                            me.drop()
                        }
                    } else if (me.throwCharge > 0) { //Matter.Query.region(mob, me.bounds)
                        if (me.holdingTarget.isPrinted) me.holdingTarget.isPrinted = undefined
                        //throw the body
                        me.fieldCDcycle = me.cycle + 20;
                        me.fireCDcycle = me.cycle + 20;

                        me.isHolding = false;

                        if (me.tech.isTokamak && me.throwCharge > 4) { //remove the block body and pulse  in the direction you are facing
                            //me.throwCharge > 5 seems to be when the field full colors in a block you are holding
                            me.throwCycle = me.cycle + 180 //used to detect if a block was thrown in the last 3 seconds
                            if (me.immuneCycle < me.cycle) me.energy += 0.25 * Math.sqrt(me.holdingTarget.mass) * Math.min(5, me.throwCharge) * level.isReducedRegen
                            me.throwCharge = 0;
                            me.definePlayerMass() //return to normal player mass
                            //remove block before pulse, so it doesn't get in the way
                            for (let i = 0; i < body.length; i++) {
                                if (body[i] === me.holdingTarget) {
                                    Matter.Composite.remove(engine.world, body[i]);
                                    body.splice(i, 1);
                                }
                            }
                            b2.pulse(60 * Math.pow(me.holdingTarget.mass, 0.25), me.angle2, me.id)
                            if (me.tech.isTokamakHeal && me.tech.tokamakHealCount < 5) {
                                me.tech.tokamakHealCount++
                                let massScale = Math.min(65 * Math.sqrt(me.maxHealth), 14 * Math.pow(me.holdingTarget.mass, 0.4))
                                if (powerUps.healGiveMaxEnergy) massScale = powerUps["heal"].size()
                                powerUps.spawn(me.pos.x, me.pos.y, "heal", true, massScale * (simulation.healScale ** 0.25) * Math.sqrt(me.tech.largerHeals * (me.tech.isHalfHeals ? 0.5 : 1)))  //    spawn(x, y, target, moving = true, mode = null, size = powerUps[target].size()) {
                            }
                        } else { //normal throw
                            //bullet-like collisions
                            me.holdingTarget.collisionFilter.category = cat.body
                            me.holdingTarget.collisionFilter.group = -me.id;
                            me.holdingTarget.collisionFilter.mask = cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet | cat.mobShield | cat.player;
                            if (me.tech.isBlockRestitution) {
                                me.holdingTarget.restitution = 0.999 //extra bouncy
                                me.holdingTarget.friction = me.holdingTarget.frictionStatic = me.holdingTarget.frictionAir = 0.001
                            }
                            //check every second to see if player is away from thrown body, and make solid
                            const solid = function (that) {
                                const dx = that.position.x - me.position.x;
                                const dy = that.position.y - me.position.y;
                                // if (that.speed < 3 && dx * dx + dy * dy > 10000 && that !== me.holdingTarget) {
                                if (dx * dx + dy * dy > 10000 && that !== me.holdingTarget) {
                                    that.collisionFilter.group = 0;
                                    that.collisionFilter.category = cat.body; //make solid
                                    that.collisionFilter.mask = cat.player | cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet; //can hit player now
                                } else {
                                    setTimeout(solid, 40, that);
                                }
                            };
                            setTimeout(solid, 200, me.holdingTarget);

                            const charge = Math.min(me.throwCharge / 5, 1)
                            //***** scale throw speed with the first number, 80 *****
                            // let speed = 80 * charge * Math.min(0.85, 0.8 / Math.pow(me.holdingTarget.mass, 0.25));
                            let speed = (me.tech.isPrinter ? 15 + 80 * charge * Math.min(0.85, 0.8 / Math.pow(me.holdingTarget.mass, 0.1)) : 80 * charge * Math.min(0.85, 0.8 / Math.pow(me.holdingTarget.mass, 0.25)))

                            if (Matter.Query.collides(me.holdingTarget, map).length !== 0) {
                                speed *= 0.7 //drop speed by 30% if touching map
                                if (Matter.Query.ray(map, me.holdingTarget.position, me.pos).length !== 0) speed = 0 //drop to zero if the center of the block can't see the center of the player through the map
                            }
                            me.throwCharge = 0;
                            me.throwCycle = me.cycle + 180 //used to detect if a block was thrown in the last 3 seconds
                            Matter.Body.setVelocity(me.holdingTarget, {
                                x: me.velocity.x * 0.5 + Math.cos(me.angle2) * speed,
                                y: me.velocity.y * 0.5 + Math.sin(me.angle2) * speed
                            });
                            Matter.Body.setVelocity(me, {
                                x: me.velocity.x - Math.cos(me.angle2) * speed / (me.crouch ? 30 : 10) * Math.sqrt(me.holdingTarget.mass),
                                y: me.velocity.y - Math.sin(me.angle2) * speed / 30 * Math.sqrt(me.holdingTarget.mass)
                            });
                            me.definePlayerMass() //return to normal player mass

                            if (me.tech.isStaticBlock) me.holdingTarget.isStatic = true
                            if (me.tech.isAddBlockMass) {
                                const expand = function (that, massLimit) {
                                    if (that.mass < massLimit) {
                                        const scale = 1.04;
                                        Matter.Body.scale(that, scale, scale);
                                        setTimeout(expand, 20, that, massLimit);
                                    }
                                };
                                expand(me.holdingTarget, Math.min(20, me.holdingTarget.mass * 3))
                            }
                            if (me.tech.isGroupThrow) {
                                const range = 810000
                                for (let i = 0; i < body.length; i++) {
                                    if (body[i] !== me.holdingTarget) {
                                        const dist2 = Vector.magnitudeSquared(Vector.sub(me.pos, body[i].position))
                                        if (dist2 < range) {
                                            const blockSpeed = 90 * charge * Math.min(0.85, 0.8 / Math.pow(body[i].mass, 0.25)) * Math.pow((range - dist2) / range, 0.2)
                                            Matter.Body.setVelocity(body[i], {
                                                x: body[i].velocity.x * 0.5 + Math.cos(me.angle2) * blockSpeed,
                                                y: body[i].velocity.y * 0.5 + Math.sin(me.angle2) * blockSpeed
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    me.isHolding = false
                }
            }
            me.pushMobsFacing = function() { // find mobs in range and in direction looking
                for (let i = 0, len = mob.length; i < len; ++i) {
                    if (
                        Vector.magnitude(Vector.sub(mob[i].position, me.pos)) - mob[i].radius < me.fieldRange &&
                        me.lookingAt(mob[i]) &&
                        !mob[i].isUnblockable &&
                        !mob[i].id == me.id &&
                        Matter.Query.ray(map, mob[i].position, me.pos).length === 0
                    ) {
                        mob[i].locatePlayer();
                        me.pushMass(mob[i]);

                        if (me.tech.deflectEnergy && !mob[i].isInvulnerable && !mob[i].isShielded) {
                            me.energy += me.tech.deflectEnergy * level.isReducedRegen
                        }
                    }
                }
                if (Vector.magnitude(Vector.sub(m.pos, me.position)) - me.radius < me.fieldRange && Matter.Query.ray(map, m.pos, me.position).length === 0) {
                    const unit = Vector.normalise(Vector.sub(me.position, player.position))
                    const massRoot = Math.sqrt(Math.min(12, Math.max(0.15, player.mass))); // masses above 12 can start to overcome the push back //idk
                    Matter.Body.setVelocity(player, {
                        x: me.velocity.x - (15 * unit.x) / massRoot,
                        y: me.velocity.y - (15 * unit.y) / massRoot
                    });
                }
            }
            me.pushMass = function(who, fieldBlockCost = (0.025 + Math.sqrt(who.mass) * Vector.magnitude(Vector.sub(who.velocity, me.velocity)) * 0.002) * me.fieldShieldingScale) {
                if (me.energy > me.minEnergyToDeflect) { //shield needs at least some of the cost to block
                    if (who.isShielded) fieldBlockCost *= 2; //shielded mobs take more energy to block
                    me.energy -= fieldBlockCost
                    if (me.energy < me.minEnergyToDeflect) {
                        me.energy = 0;
                        me.fieldCDcycle = me.cycle + Math.max(me.fieldBlockCD, 60);
                        if (me.tech.isLaserField) {
                            simulation.ephemera.push({
                                count: 20 + Math.floor(me.maxEnergy * 30 * 0.0018 / me.tech.laserDrain), //how many cycles the ephemera lasts, scales with max energy
                                do() {
                                    this.count--
                                    if (this.count < 0) simulation.removeEphemera(this)
                                    for (let i = 0, num = 12; i < num; i++) { //draw random lasers
                                        const angle = 6.28 * i / num + me.cycle * 0.04
                                        if (me.tech.isLaserLens) { //&& b.guns[11].isInsideArc(angle)
                                            // b.guns[11].lens()
                                            b2.laser({ x: me.pos.x + 30 * Math.cos(angle), y: me.pos.y + 30 * Math.sin(angle) }, { x: me.pos.x + 3000 * Math.cos(angle), y: me.pos.y + 3000 * Math.sin(angle) }, me.tech.laserDamage * 2.5 * b.guns[11].lensDamage, me.id)//dmg = me.tech.laserDamage, reflections = me.tech.laserReflections, isThickBeam = false, push = 1
                                        } else {
                                            b2.laser({ x: me.pos.x + 30 * Math.cos(angle), y: me.pos.y + 30 * Math.sin(angle) }, { x: me.pos.x + 3000 * Math.cos(angle), y: me.pos.y + 3000 * Math.sin(angle) }, me.tech.laserDamage * 2.5, me.id)//dmg = me.tech.laserDamage, reflections = me.tech.laserReflections, isThickBeam = false, push = 1
                                        }

                                    }
                                },
                            })
                        }
                    } else {
                        me.fieldCDcycle = me.cycle + me.fieldBlockCD;
                    }
                    if (!who.isInvulnerable && (me.coupling && me.fieldMode === 0) && bullet.length < 200) { //for field emitter iceIX
                        for (let i = 0; i < me.coupling; i++) {
                            if (0.1 * me.coupling - i > 1.25 * Math.random()) {
                                const sub = Vector.mult(Vector.normalise(Vector.sub(who.position, me.pos)), (me.fieldRange * me.harmonicRadius) * (0.4 + 0.3 * Math.random())) //me.harmonicRadius should be 1 unless you are standing wave expansion
                                const rad = Vector.rotate(sub, 1 * (Math.random() - 0.5))
                                const angle = Math.atan2(sub.y, sub.x)
                                b2.iceIX(6 + 6 * Math.random(), angle + 3 * (Math.random() - 0.5), Vector.add(me.pos, rad), me.id)
                            }
                        }
                    }
                    me.bulletsToBlocks(who)
                    const unit = Vector.normalise(Vector.sub(me.position, who.position))
                    if (me.tech.blockDmg) {
                        Matter.Body.setVelocity(who, { x: 0.5 * who.velocity.x, y: 0.5 * who.velocity.y });
                        if (who.isShielded) {
                            for (let i = 0, len = mob.length; i < len; i++) {
                                if (mob[i].id === who.shieldID) mob[i].damage(me.tech.blockDmg * (me.tech.isBlockRadiation ? 6 : 2), true)
                            }
                        } else if (me.tech.isBlockRadiation) {
                            if (who.isMobBullet) {
                                who.damage(me.tech.blockDmg * 3, true)
                            } else {
                                mobs.statusDoT(who, me.tech.blockDmg * 0.42, 180) //200% increase -> x (1+2) //over 7s -> 360/30 = 12 half seconds -> 3/12
                            }
                        } else {
                            who.damage(me.tech.blockDmg, true)
                        }
                        const step = 40
                        ctx.beginPath(); //draw electricity
                        for (let i = 0, len = 0.5 * me.tech.blockDmg; i < len; i++) {
                            let x = me.pos.x - 20 * unit.x;
                            let y = me.pos.y - 20 * unit.y;
                            ctx.moveTo(x, y);
                            for (let i = 0; i < 8; i++) {
                                x += step * (-unit.x + 1.5 * (Math.random() - 0.5))
                                y += step * (-unit.y + 1.5 * (Math.random() - 0.5))
                                ctx.lineTo(x, y);
                            }
                        }
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = "#f0f";
                        ctx.stroke();
                    } else {
                        me.drawHold(who);
                    }
                    if (me.tech.isStunField) mobs.statusStun(who, me.tech.isStunField)
                    //knock backs
                    const massRoot = Math.sqrt(Math.min(12, Math.max(0.15, who.mass))); // masses above 12 can start to overcome the push back
                    Matter.Body.setVelocity(who, { x: me.velocity.x - (15 * unit.x) / massRoot, y: me.velocity.y - (15 * unit.y) / massRoot });
                    if (who.isUnstable) {
                        if (me.fieldCDcycle < me.cycle + 30) me.fieldCDcycle = me.cycle + 10
                        who.death();
                    }
                    if (me.crouch) {
                        Matter.Body.setVelocity(me, { x: me.velocity.x + 0.1 * me.blockingRecoil * unit.x * massRoot, y: me.velocity.y + 0.1 * me.blockingRecoil * unit.y * massRoot });
                    } else {
                        Matter.Body.setVelocity(me, { x: me.velocity.x + me.blockingRecoil * unit.x * massRoot, y: me.velocity.y + me.blockingRecoil * unit.y * massRoot });
                    }
                }
            }
            me.bulletsToBlocks = function(who) {
                if (who.isMobBullet && !who.isInvulnerable && who.mass < 10 && body.length < mobs.maxMobBody) {
                    // spawn block
                    body[body.length] = Matter.Bodies.polygon(who.position.x, who.position.y, who.vertices.length, who.radius, {
                        friction: 0.05,
                        frictionAir: 0.001,
                        collisionFilter: {
                            category: cat.bullet,
                            mask: cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet | cat.mobShield
                        },
                        classType: "body",
                        isPrinted: true,
                        radius: 10, //used to grow and warp the shape of the block
                        density: 0.002, //double density for 2x damage
                    });
                    const block = body[body.length - 1]
                    Composite.add(engine.world, block); //add to world
                    //reverse velocity and make sure it's above 40
                    const unit = Vector.mult(Vector.normalise(who.velocity), -Math.max(40, who.speed))
                    Matter.Body.setVelocity(block, unit);

                    simulation.ephemera.push({
                        count: 120, //cycles before it self removes
                        do() {
                            this.count--
                            if (this.count < 0) {
                                simulation.removeEphemera(this)
                                Matter.Composite.remove(engine.world, block);
                                //find block
                                for (let i = 0; i < body.length; i++) {
                                    if (body[i] === block) {
                                        body.splice(i, 1);
                                        break
                                    }
                                }

                            }
                        },
                    })
                    //remove mob bullet
                    Matter.Composite.remove(engine.world, who); //remove from physics early to avoid collisions with block
                    who.alive = false
                }
            }
            me.drawField = function() {
                if (me.holdingTarget) {
                    ctx.fillStyle = "rgba(110,170,200," + (me.energy * (0.05 + 0.05 * Math.random())) + ")";
                    ctx.strokeStyle = "rgba(110, 200, 235, " + (0.3 + 0.08 * Math.random()) + ")" //"#9bd" //"rgba(110, 200, 235, " + (0.5 + 0.1 * Math.random()) + ")"
                } else {
                    ctx.fillStyle = "rgba(110,170,200," + (0.02 + me.energy * (0.15 + 0.15 * Math.random())) + ")";
                    ctx.strokeStyle = "rgba(110, 200, 235, " + (0.6 + 0.2 * Math.random()) + ")" //"#9bd" //"rgba(110, 200, 235, " + (0.5 + 0.1 * Math.random()) + ")"
                }
                if (me.fieldMode != 2) {
                    const angle = me.angle2;
                    const range = me.fieldRange;
                    ctx.beginPath();
                    ctx.arc(me.pos.x, me.pos.y, range, angle - Math.PI * me.fieldArc, angle + Math.PI * me.fieldArc, false);
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    let eye = 13;
                    if (me.fieldMode == 2) {
                        eye = 30
                    }
                    let aMag = 0.75 * Math.PI * me.fieldArc
                    let a = angle + aMag
                    let cp1x = me.pos.x + 0.6 * range * Math.cos(a)
                    let cp1y = me.pos.y + 0.6 * range * Math.sin(a)
                    ctx.quadraticCurveTo(cp1x, cp1y, me.pos.x + eye * Math.cos(angle), me.pos.y + eye * Math.sin(angle))
                    a = angle - aMag
                    cp1x = me.pos.x + 0.6 * range * Math.cos(a)
                    cp1y = me.pos.y + 0.6 * range * Math.sin(a)
                    ctx.quadraticCurveTo(cp1x, cp1y, me.pos.x + 1 * range * Math.cos(angle - Math.PI * me.fieldArc), me.pos.y + 1 * range * Math.sin(angle - Math.PI * me.fieldArc))
                    ctx.fill();
                    // ctx.lineTo(me.pos.x + eye * Math.cos(angle), me.pos.y + eye * Math.sin(angle));

                    //draw random lines in field for cool effect
                    let offAngle = angle + 1.7 * Math.PI * me.fieldArc * (Math.random() - 0.5);
                    ctx.beginPath();
                    eye = 15;
                    ctx.moveTo(me.pos.x + eye * Math.cos(angle), me.pos.y + eye * Math.sin(angle));
                    ctx.lineTo(me.pos.x + range * Math.cos(offAngle), me.pos.y + range * Math.sin(offAngle));
                    ctx.strokeStyle = "rgba(0,0,0,0.6)";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    const wave = Math.cos(me.cycle * 0.022);
                    const angle = me.angle2;
                    ctx.arc(me.pos.x, me.pos.y, me.fieldRange, angle - Math.PI * me.fieldArc, angle + Math.PI * me.fieldArc, false);
                    ctx.lineWidth = 2.5 - 1.5 * wave;
                    ctx.stroke();
                    const curve = 0.57 + 0.04 * wave
                    const aMag = (1 - curve * 1.2) * Math.PI * me.fieldArc
                    let a = angle + aMag
                    let cp1x = me.pos.x + curve * me.fieldRange * Math.cos(a)
                    let cp1y = me.pos.y + curve * me.fieldRange * Math.sin(a)
                    ctx.quadraticCurveTo(cp1x, cp1y, me.pos.x + 30 * Math.cos(angle), me.pos.y + 30 * Math.sin(angle))
                    a = angle - aMag
                    cp1x = me.pos.x + curve * me.fieldRange * Math.cos(a)
                    cp1y = me.pos.y + curve * me.fieldRange * Math.sin(a)
                    ctx.quadraticCurveTo(cp1x, cp1y, me.pos.x + 1 * me.fieldRange * Math.cos(angle - Math.PI * me.fieldArc), me.pos.y + 1 * me.fieldRange * Math.sin(angle - Math.PI * me.fieldArc))
                    ctx.fill();
                }
            }
            me.lookForBlock = function() { //find body to pickup
                const grabbing = {
                    targetIndex: null,
                    targetRange: 150,
                    // lookingAt: false //false to pick up object in range, but not looking at
                };
                for (let i = 0, len = body.length; i < len; ++i) {
                    if (Matter.Query.ray(map, body[i].position, me.pos).length === 0) {
                        //is m next body a better target then my current best
                        const dist = Vector.magnitude(Vector.sub(body[i].position, me.pos));
                        const looking = me.lookingAt(body[i]);
                        // if (dist < grabbing.targetRange && (looking || !grabbing.lookingAt) && !body[i].isNotHoldable) {
                        if (dist < grabbing.targetRange + 30 && looking && !body[i].isNotHoldable) {
                            grabbing.targetRange = dist;
                            grabbing.targetIndex = i;
                            // grabbing.lookingAt = looking;
                        }
                    }
                }
                // set pick up target for when mouse is released
                if (body[grabbing.targetIndex]) {
                    me.holdingTarget = body[grabbing.targetIndex];
                    ctx.beginPath(); //draw on each valid body
                    let vertices = me.holdingTarget.vertices;
                    ctx.moveTo(vertices[0].x, vertices[0].y);
                    for (let j = 1; j < vertices.length; j += 1) {
                        ctx.lineTo(vertices[j].x, vertices[j].y);
                    }
                    ctx.lineTo(vertices[0].x, vertices[0].y);
                    ctx.fillStyle = "rgba(190,215,230," + (0.3 + 0.7 * Math.random()) + ")";
                    ctx.fill();

                    ctx.globalAlpha = 0.2;
                    me.drawHold(me.holdingTarget);
                    ctx.globalAlpha = 1;
                } else {
                    me.holdingTarget = null;
                }
            }
            me.pickUp = function() {
                //triggers when a hold target exits and field button is released
                me.isHolding = true;
                //conserve momentum when me mass changes
                totalMomentum = Vector.add(Vector.mult(me.velocity, me.mass), Vector.mult(me.holdingTarget.velocity, me.holdingTarget.mass))
                Matter.Body.setVelocity(me, Vector.mult(totalMomentum, 1 / (me.defaultMass + me.holdingTarget.mass)));

                me.definePlayerMass(me.defaultMass + me.holdingTarget.mass * me.holdingMassScale)
                //make block collide with nothing
                me.holdingTarget.collisionFilter.category = 0;
                me.holdingTarget.collisionFilter.mask = 0;
            }
            me.calculateFieldThreshold = function() {
                me.fieldThreshold = Math.cos((me.fieldArc) * Math.PI)
            }
            me.lookingAt = function(who) {
                const diff = Vector.normalise(Vector.sub(who.position, me.pos));
                const dir = { x: Math.cos(me.angle2), y: Math.sin(me.angle2) };
                if (Vector.dot(dir, diff) > me.fieldThreshold) {
                    return true;
                }
                return false;
            }
            me.grabPowerUp = function() { //look for power ups to grab with field
                if (me.fireCDcycle < me.cycle) me.fireCDcycle = me.cycle - 1
                for (let i = 0, len = powerUp.length; i < len; ++i) {
                    if (me.tech.isEnergyNoAmmo && powerUp[i].name === "ammo") continue
                    const dxP = me.pos.x - powerUp[i].position.x;
                    const dyP = me.pos.y - powerUp[i].position.y;
                    const dist2 = dxP * dxP + dyP * dyP + 10;
                    // float towards me  if looking at and in range  or  if very close to me
                    if (
                        dist2 < me.grabPowerUpRange2 &&
                        (me.lookingAt(powerUp[i]) || dist2 < 10000) &&
                        Matter.Query.ray(map, powerUp[i].position, me.pos).length === 0
                    ) {
                        if (!me.tech.isHealAttract || powerUp[i].name !== "heal") { //if you have accretion heals are already pulled in a different way
                            powerUp[i].force.x += 0.04 * (dxP / Math.sqrt(dist2)) * powerUp[i].mass;
                            powerUp[i].force.y += 0.04 * (dyP / Math.sqrt(dist2)) * powerUp[i].mass - powerUp[i].mass * simulation.g; //negate gravity
                            Matter.Body.setVelocity(powerUp[i], { x: powerUp[i].velocity.x * 0.11, y: powerUp[i].velocity.y * 0.11 }); //extra friction
                        }
                        if ( //use power up if it is close enough
                            dist2 < 5000 &&
                            !simulation.isChoosing &&
                            (powerUp[i].name !== "heal" || me.maxHealth - me.health > 0.01 || me.tech.isOverHeal)
                        ) {
                            powerUps.onPickUp(powerUp[i]);
                            Matter.Body.setVelocity(me, { //me knock back, after grabbing power up
                                x: me.velocity.x + powerUp[i].velocity.x / me.mass * 4 * powerUp[i].mass,
                                y: me.velocity.y + powerUp[i].velocity.y / me.mass * 4 * powerUp[i].mass
                            });
                            Matter.Composite.remove(engine.world, powerUp[i]);
                            powerUp.splice(i, 1);
                            return; //because the array order is messed up after splice
                        }
                    }
                }
            }
            me.grabPowerUpEasy = function() { //look for power ups to grab with field
                for (let i = 0, len = powerUp.length; i < len; ++i) {
                    if (me.tech.isEnergyNoAmmo && powerUp[i].name === "ammo") continue
                    const dxP = me.pos.x - powerUp[i].position.x;
                    const dyP = me.pos.y - powerUp[i].position.y;
                    const dist2 = dxP * dxP + dyP * dyP + 10;
                    // float towards me
                    if (dist2 < me.grabPowerUpRange2 && Matter.Query.ray(map, powerUp[i].position, me.pos).length === 0) {
                        if (!me.tech.isHealAttract || powerUp[i].name !== "heal") { //if you have accretion heals are already pulled in a different way
                            powerUp[i].force.x += 0.05 * (dxP / Math.sqrt(dist2)) * powerUp[i].mass;
                            powerUp[i].force.y += 0.05 * (dyP / Math.sqrt(dist2)) * powerUp[i].mass - powerUp[i].mass * simulation.g; //negate gravity
                            Matter.Body.setVelocity(powerUp[i], { x: powerUp[i].velocity.x * 0.11, y: powerUp[i].velocity.y * 0.11 }); //extra friction
                        }
                        if ( //use power up if it is close enough
                            dist2 < 20000 &&
                            !simulation.isChoosing &&
                            (powerUp[i].name !== "heal" || me.maxHealth - me.health > 0.01 || me.tech.isOverHeal)
                        ) {
                            powerUps.onPickUp(powerUp[i]);
                            Matter.Body.setVelocity(me, { //me knock back, after grabbing power up
                                x: me.velocity.x + powerUp[i].velocity.x / me.mass * 4 * powerUp[i].mass,
                                y: me.velocity.y + powerUp[i].velocity.y / me.mass * 4 * powerUp[i].mass
                            });
                            Matter.Composite.remove(engine.world, powerUp[i]);
                            powerUp.splice(i, 1);
                            return; //because the array order is messed up after splice
                        }
                    }
                }
            }
            me.drop = function() {
                if (me.isHolding) {
                    me.fieldCDcycle = me.cycle + 15;
                    me.isHolding = false;
                    me.throwCharge = 0;
                    me.definePlayerMass()
                }
                if (me.holdingTarget) {
                    me.holdingTarget.collisionFilter.category = cat.body;
                    me.holdingTarget.collisionFilter.mask = cat.player | cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet
                    me.holdingTarget = null;
                }
            }
            me.definePlayerMass = function(mass = m.defaultMass) {
                Matter.Body.setMass(me, mass);
                me.setMovement()
                me.yOffWhen.stand = Math.max(me.yOffWhen.crouch, Math.min(49, 49 - (mass - 5) * 6))
                if (me.onGround && !me.crouch) me.yOffGoal = me.yOffWhen.stand;
            }
            me.setHoldDefaults = function() {
                if (me.energy < me.maxEnergy) me.energy = me.maxEnergy;
                me.fieldMeterColor = "#0cf"
                me.eyeFillColor = me.fieldMeterColor
                me.fieldShieldingScale = 1;
                me.fieldBlockCD = 10;
                me.fieldDamage = 1
                me.fieldHarmReduction = 1;
                me.isSneakAttack = false
                me.duplicateChance = 0
                me.grabPowerUpRange2 = 200000;
                me.blockingRecoil = 4;
                me.fieldRange = 155;
                me.fieldFire = false;
                me.fieldCDcycle = 0;
                me.isCloak = false;
                me.airSpeedLimit = 125
                me.fieldFx = 1
                me.fieldJump = 1
                me.throwCharge = 0;
                // me.setFieldRegen();
                me.setMovement();
                me.drop();
                me.holdingMassScale = 0.5;
                me.fieldArc = 0.2; 
                me.calculateFieldThreshold(); 
                me.isTimeDilated = false;
                me.hole = {
                    isOn: false,
                    isReady: false,
                    pos1: { x: 0, y: 0 },
                    pos2: { x: 0, y: 0 },
                }
            }
            me.regenEnergy = function() { //used in drawRegenEnergy  // rewritten by some tech
                if (me.immuneCycle < me.cycle && me.fieldCDcycle < me.cycle) me.energy += me.fieldRegen * level.isReducedRegen;
                if (me.energy < 0) me.energy = 0
            }
            me.setHoldDefaults();
            me.harmonic3Phase = function() { //normal standard 3 different 2-d circles
                const fieldRange1 = (0.75 + 0.3 * Math.sin(me.cycle / 23)) * me.fieldRange * me.harmonicRadius
                const fieldRange2 = (0.68 + 0.37 * Math.sin(me.cycle / 37)) * me.fieldRange * me.harmonicRadius
                const fieldRange3 = (0.7 + 0.35 * Math.sin(me.cycle / 47)) * me.fieldRange * me.harmonicRadius
                const netFieldRange = Math.max(fieldRange1, fieldRange2, fieldRange3)
                ctx.fillStyle = "rgba(110,170,200," + Math.min(0.55, (0.04 + 0.7 * me.energy * (0.1 + 0.11 * Math.random()))) + ")";
                ctx.beginPath();
                ctx.arc(me.pos.x, me.pos.y, fieldRange1, 0, 2 * Math.PI);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(me.pos.x, me.pos.y, fieldRange2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(me.pos.x, me.pos.y, fieldRange3, 0, 2 * Math.PI);
                ctx.fill();
                //360 block
                let targets = [...mob]
                for (let i = 0, len = mob.length; i < len; ++i) {
                    if (Vector.magnitude(Vector.sub(mob[i].position, me.pos)) - (targets[i] == player ? me.radius : targets[i].radius) < netFieldRange && !targets[i].isUnblockable && targets[i].id != me.id) { // && Matter.Query.ray(map, mob[i].position, me.pos).length === 0
                        if (this.drainCD > me.cycle) {
                            me.pushMass(targets[i], 0);
                        } else {
                            me.pushMass(targets[i]);
                            this.drainCD = me.cycle + 15
                        }
                    }
                }
                if (Vector.magnitude(Vector.sub(player.position, me.position)) - me.radius < netFieldRange) {
                    const unit = Vector.normalise(Vector.sub(me.position, player.position))
                    const massRoot = Math.sqrt(Math.min(12, Math.max(0.15, player.mass))); // masses above 12 can start to overcome the push back //idk
                    Matter.Body.setVelocity(player, {
                        x: me.velocity.x - (15 * unit.x) / massRoot,
                        y: me.velocity.y - (15 * unit.y) / massRoot
                    });
                }
            }
            me.harmonicRadius = 1 //for smoothing function when player holds mouse (for harmonicAtomic)
            me.harmonicAtomic = function() { //several ellipses spinning about different axises
                const rotation = simulation.cycle * 0.0031
                const phase = simulation.cycle * 0.023
                const radius = me.fieldRange * me.harmonicRadius
                ctx.lineWidth = 1;
                ctx.strokeStyle = "rgba(110,170,200,0.8)"
                ctx.fillStyle = "rgba(110,170,200," + Math.min(0.6, 0.7 * me.energy * (0.11 + 0.1 * Math.random()) * (3 / me.tech.harmonics)) + ")";
                // ctx.fillStyle = "rgba(110,170,200," + Math.min(0.7, me.energy * (0.22 - 0.01 * me.tech.harmonics) * (0.5 + 0.5 * Math.random())) + ")";
                for (let i = 0; i < me.tech.harmonics; i++) {
                    ctx.beginPath();
                    ctx.ellipse(me.pos.x, me.pos.y, radius * Math.abs(Math.sin(phase + i / me.tech.harmonics * Math.PI)), radius, rotation + i / me.tech.harmonics * Math.PI, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                }
                //360 block
                if (Vector.magnitude(Vector.sub(player.position, me.position)) - me.radius < radius) {
                    const unit = Vector.normalise(Vector.sub(me.position, player.position))
                    const massRoot = Math.sqrt(Math.min(12, Math.max(0.15, player.mass))); // masses above 12 can start to overcome the push back //idk
                    Matter.Body.setVelocity(player, {
                        x: me.velocity.x - (15 * unit.x) / massRoot,
                        y: me.velocity.y - (15 * unit.y) / massRoot
                    });
                }
                let targets = [...mob]
                for (let i = 0, len = targets.length; i < len; ++i) {
                    if (Vector.magnitude(Vector.sub(targets[i].position, me.pos)) - (targets[i] == player ? me.radius : targets[i].radius) < radius && !targets[i].isUnblockable && targets[i].id != me.id) { // && Matter.Query.ray(map, mob[i].position, me.pos).length === 0
                        if (this.drainCD > me.cycle) {
                            me.pushMass(targets[i], 0);
                        } else {
                            me.pushMass(targets[i]);
                            this.drainCD = me.cycle + 15
                        }
                    }
                }
            }
            me.perfectPush = function(isFree = false) {
                if (me.fieldCDcycle < me.cycle) {
                    for (let i = 0, len = mob.length; i < len; ++i) {
                        if (
                            Vector.magnitude(Vector.sub(mob[i].position, me.fieldPosition)) - mob[i].radius < me.fieldRange &&
                            !mob[i].isUnblockable && mob[i].id != me.id &&
                            Vector.dot({ x: Math.cos(me.fieldAngle), y: Math.sin(me.fieldAngle) }, Vector.normalise(Vector.sub(mob[i].position, me.fieldPosition))) > me.fieldThreshold &&
                            Matter.Query.ray(map, mob[i].position, me.fieldPosition).length === 0
                        ) {
                            const unit = Vector.normalise(Vector.sub(me.fieldPosition, mob[i].position))
                            me.fieldCDcycle = me.cycle + me.fieldBlockCD + (mob[i].isShielded ? 10 : 0);
                            if (!mob[i].isInvulnerable && bullet.length < 250) {
                                for (let i = 0; i < me.coupling; i++) {
                                    if (0.1 * me.coupling - i > Math.random()) {
                                        const angle = me.fieldAngle + 4 * me.fieldArc * (Math.random() - 0.5)
                                        const radius = me.fieldRange * (0.6 + 0.3 * Math.random())
                                        b2.iceIX(6 + 6 * Math.random(), angle, Vector.add(me.fieldPosition, {
                                            x: radius * Math.cos(angle),
                                            y: radius * Math.sin(angle)
                                        }), me.id)
                                    }
                                }
                            }
                            if (me.tech.blockDmg) { //electricity
                                Matter.Body.setVelocity(mob[i], { x: 0.5 * mob[i].velocity.x, y: 0.5 * mob[i].velocity.y });
                                if (mob[i].isShielded) {
                                    for (let j = 0, len = mob.length; j < len; j++) {
                                        if (mob[j].id === mob[i].shieldID) mob[j].damage(me.tech.blockDmg * (me.tech.isBlockRadiation ? 6 : 2), true)
                                    }
                                } else if (me.tech.isBlockRadiation) {
                                    if (mob[i].isMobBullet) {
                                        mob[i].damage(me.tech.blockDmg * 3, true)
                                    } else {
                                        mobs.statusDoT(mob[i], me.tech.blockDmg * 0.42, 180) //200% increase -> x (1+2) //over 7s -> 360/30 = 12 half seconds -> 3/12
                                    }
                                } else {
                                    mob[i].damage(me.tech.blockDmg, true)
                                }
                                const step = 40
                                ctx.beginPath();
                                for (let i = 0, len = 0.5 * me.tech.blockDmg; i < len; i++) {
                                    let x = me.fieldPosition.x - 20 * unit.x;
                                    let y = me.fieldPosition.y - 20 * unit.y;
                                    ctx.moveTo(x, y);
                                    for (let i = 0; i < 8; i++) {
                                        x += step * (-unit.x + 1.5 * (Math.random() - 0.5))
                                        y += step * (-unit.y + 1.5 * (Math.random() - 0.5))
                                        ctx.lineTo(x, y);
                                    }
                                }
                                ctx.lineWidth = 3;
                                ctx.strokeStyle = "#f0f";
                                ctx.stroke();
                            } else if (isFree) {
                                ctx.lineWidth = 2; //when blocking draw this graphic
                                ctx.fillStyle = `rgba(110,150,220, ${0.2 + 0.4 * Math.random()})`
                                ctx.strokeStyle = "#000";
                                const len = mob[i].vertices.length - 1;
                                const mag = mob[i].radius
                                ctx.beginPath();
                                ctx.moveTo(mob[i].vertices[len].x + mag * (Math.random() - 0.5), mob[i].vertices[len].y + mag * (Math.random() - 0.5))
                                for (let j = 0; j < len; j++) {
                                    ctx.lineTo(mob[i].vertices[j].x + mag * (Math.random() - 0.5), mob[i].vertices[j].y + mag * (Math.random() - 0.5));
                                }
                                ctx.lineTo(mob[i].vertices[len].x + mag * (Math.random() - 0.5), mob[i].vertices[len].y + mag * (Math.random() - 0.5))
                                ctx.fill();
                                ctx.stroke();
                            } else {

                                const eye = 15; //when blocking draw this graphic
                                const len = mob[i].vertices.length - 1;
                                ctx.lineWidth = 1;
                                ctx.fillStyle = `rgba(110,150,220, ${0.2 + 0.4 * Math.random()})`
                                ctx.strokeStyle = "#000";
                                ctx.beginPath();
                                ctx.moveTo(me.fieldPosition.x + eye * Math.cos(me.fieldAngle), me.fieldPosition.y + eye * Math.sin(me.fieldAngle));
                                ctx.lineTo(mob[i].vertices[len].x, mob[i].vertices[len].y);
                                ctx.lineTo(mob[i].vertices[0].x, mob[i].vertices[0].y);
                                ctx.fill();
                                ctx.stroke();
                                for (let j = 0; j < len; j++) {
                                    ctx.beginPath();
                                    ctx.moveTo(me.fieldPosition.x + eye * Math.cos(me.fieldAngle), me.fieldPosition.y + eye * Math.sin(me.fieldAngle));
                                    ctx.lineTo(mob[i].vertices[j].x, mob[i].vertices[j].y);
                                    ctx.lineTo(mob[i].vertices[j + 1].x, mob[i].vertices[j + 1].y);
                                    ctx.fill();
                                    ctx.stroke();
                                }
                            }
                            me.bulletsToBlocks(mob[i])
                            if (me.tech.isStunField) mobs.statusStun(mob[i], me.tech.isStunField)
                            //mob knock backs
                            const massRoot = Math.sqrt(Math.max(1, mob[i].mass));
                            Matter.Body.setVelocity(mob[i], {
                                x: me.velocity.x - (30 * unit.x) / massRoot,
                                y: me.velocity.y - (30 * unit.y) / massRoot
                            });
                            if (mob[i].isUnstable) {
                                if (me.fieldCDcycle < me.cycle + 10) me.fieldCDcycle = me.cycle + 6
                                mob[i].death();
                            }
                            if (!isFree) { //player knock backs
                                if (mob[i].isDropPowerUp && me.speed < 12) {
                                    const massRootCap = Math.sqrt(Math.min(10, Math.max(0.2, mob[i].mass)));
                                    Matter.Body.setVelocity(me, {
                                        x: 0.9 * me.velocity.x + 0.6 * unit.x * massRootCap,
                                        y: 0.9 * me.velocity.y + 0.6 * unit.y * massRootCap
                                    });
                                }
                            }
                        }
                    }
                    if (
                        Vector.magnitude(Vector.sub(player.position, me.fieldPosition)) - m.radius < me.fieldRange &&
                        Vector.dot({ x: Math.cos(me.fieldAngle), y: Math.sin(me.fieldAngle) }, Vector.normalise(Vector.sub(player.position, me.fieldPosition))) > me.fieldThreshold &&
                        Matter.Query.ray(map, player.position, me.fieldPosition).length === 0
                    ) {
                        const unit = Vector.normalise(Vector.sub(me.fieldPosition, player.position))
                        me.fieldCDcycle = me.cycle + me.fieldBlockCD;
                        if (!player.isInvulnerable && bullet.length < 250) {
                            for (let i = 0; i < me.coupling; i++) {
                                if (0.1 * me.coupling - i > Math.random()) {
                                    const angle = me.fieldAngle + 4 * me.fieldArc * (Math.random() - 0.5)
                                    const radius = me.fieldRange * (0.6 + 0.3 * Math.random())
                                    b2.iceIX(6 + 6 * Math.random(), angle, Vector.add(me.fieldPosition, {
                                        x: radius * Math.cos(angle),
                                        y: radius * Math.sin(angle)
                                    }), me.id)
                                }
                            }
                        }
                        if (me.tech.blockDmg) {
                            Matter.Body.setVelocity(player, { x: 0.5 * player.velocity.x, y: 0.5 * player.velocity.y });
                            const step = 40
                            ctx.beginPath();
                            for (let i = 0, len = 0.5 * me.tech.blockDmg; i < len; i++) {
                                let x = me.fieldPosition.x - 20 * unit.x;
                                let y = me.fieldPosition.y - 20 * unit.y;
                                ctx.moveTo(x, y);
                                for (let i = 0; i < 8; i++) {
                                    x += step * (-unit.x + 1.5 * (Math.random() - 0.5))
                                    y += step * (-unit.y + 1.5 * (Math.random() - 0.5))
                                    ctx.lineTo(x, y);
                                }
                            }
                            ctx.lineWidth = 3;
                            ctx.strokeStyle = "#f0f";
                            ctx.stroke();
                        } else if (isFree) {
                            ctx.lineWidth = 2; //when blocking draw this graphic
                            ctx.fillStyle = `rgba(110,150,220, ${0.2 + 0.4 * Math.random()})`
                            ctx.strokeStyle = "#000";
                            const len = player.vertices.length - 1;
                            const mag = m.radius
                            ctx.beginPath();
                            ctx.moveTo(player.vertices[len].x + mag * (Math.random() - 0.5), player.vertices[len].y + mag * (Math.random() - 0.5))
                            for (let j = 0; j < len; j++) {
                                ctx.lineTo(player.vertices[j].x + mag * (Math.random() - 0.5), player.vertices[j].y + mag * (Math.random() - 0.5));
                            }
                            ctx.lineTo(player.vertices[len].x + mag * (Math.random() - 0.5), player.vertices[len].y + mag * (Math.random() - 0.5))
                            ctx.fill();
                            ctx.stroke();
                        } else {

                            const eye = 15; //when blocking draw this graphic
                            const len = player.vertices.length - 1;
                            ctx.lineWidth = 1;
                            ctx.fillStyle = `rgba(110,150,220, ${0.2 + 0.4 * Math.random()})`
                            ctx.strokeStyle = "#000";
                            ctx.beginPath();
                            ctx.moveTo(me.fieldPosition.x + eye * Math.cos(me.fieldAngle), me.fieldPosition.y + eye * Math.sin(me.fieldAngle));
                            ctx.lineTo(player.vertices[len].x, player.vertices[len].y);
                            ctx.lineTo(player.vertices[0].x, player.vertices[0].y);
                            ctx.fill();
                            ctx.stroke();
                            for (let j = 0; j < len; j++) {
                                ctx.beginPath();
                                ctx.moveTo(me.fieldPosition.x + eye * Math.cos(me.fieldAngle), me.fieldPosition.y + eye * Math.sin(me.fieldAngle));
                                ctx.lineTo(player.vertices[j].x, player.vertices[j].y);
                                ctx.lineTo(player.vertices[j + 1].x, player.vertices[j + 1].y);
                                ctx.fill();
                                ctx.stroke();
                            }
                        }
                        const massRoot = Math.sqrt(Math.max(1, player.mass));
                        Matter.Body.setVelocity(player, {
                            x: player.velocity.x - (30 * unit.x) / massRoot,
                            y: player.velocity.y - (30 * unit.y) / massRoot
                        });
                        if (!isFree) { //me knock backs
                            if (me.isDropPowerUp && me.speed < 12) {
                                const massRootCap = Math.sqrt(Math.min(10, Math.max(0.2, me.mass)));
                                Matter.Body.setVelocity(me, {
                                    x: 0.9 * me.velocity.x + 0.6 * unit.x * massRootCap,
                                    y: 0.9 * me.velocity.y + 0.6 * unit.y * massRootCap
                                });
                            }
                        }
                    }
                }
            }
            me.drawCloak = function () {
                if(me.fieldDrawRadius < 1) return;
                me.fieldPhase += 0.007
                const wiggle = 0.15 * Math.sin(me.fieldPhase * 0.5)
                ctx.save();
                ctx.beginPath();
                ctx.ellipse(me.pos.x, me.pos.y, me.fieldDrawRadius * (1 - wiggle), me.fieldDrawRadius * (1 + wiggle), me.fieldPhase, 0, 2 * Math.PI);
                ctx.globalCompositeOperation = "destination-out"; 
                ctx.fillStyle = "#fff";
                ctx.fill();
                ctx.restore();
            }
            me.timeStop = function() {
                ctx.globalCompositeOperation = "saturation"
                ctx.fillStyle = "#ccc";
                ctx.fillRect(-50000, -50000, 100000, 100000)
                ctx.globalCompositeOperation = "source-over"
                me.isTimeDilated = true;

                function sleep(who) {
                    for (let i = 0, len = who.length; i < len; ++i) {
                        if (who[i].id != me.id) {
                            if (!who[i].isSleeping) {
                                who[i].storeVelocity = who[i].velocity
                                who[i].storeAngularVelocity = who[i].angularVelocity
                            }
                            Matter.Sleeping.set(who[i], true)
                        }
                    }
                }
                sleep(mob);
                sleep(body);
                sleep(bullet);
                simulation.cycle--;
            }
            me.wakeCheck = function() {
                if (me.isTimeDilated) {
                    me.isTimeDilated = false;
                    function wake(who) {
                        for (let i = 0, len = who.length; i < len; ++i) {
                            Matter.Sleeping.set(who[i], false)
                            if (who[i].storeVelocity) {
                                Matter.Body.setVelocity(who[i], { x: who[i].storeVelocity.x, y: who[i].storeVelocity.y })
                                Matter.Body.setAngularVelocity(who[i], who[i].storeAngularVelocity)
                            }
                        }
                    }
                    wake(mob);
                    wake(body);
                    wake(bullet);
                    wake(player);
                    for (let i = 0, len = cons.length; i < len; i++) {
                        if (cons[i].stiffness === 0) {
                            cons[i].stiffness = cons[i].storeStiffness
                        }
                    }
                }
            }
            me.lastAngle = 0
            me.wasExtruderOn = false
            me.isExtruderOn = false
            me.didExtruderDrain = false
            me.canExtruderFire = true
            me.extruder = function() {
                const DRAIN = 0.0012
                if (me.energy > DRAIN && me.canExtruderFire) {
                    if (me.energy < 0) {
                        me.fieldCDcycle = me.cycle + 120;
                        me.energy = 0;
                    }
                    me.isExtruderOn = true
                    const SPEED = 8 + 12 * me.tech.isPlasmaRange
                    const em = bullet.length;
                    const where = Vector.add(me.pos, me.velocity)
                    bullet[em] = Bodies.polygon(where.x + 20 * Math.cos(me.angle2), where.y + 20 * Math.sin(me.angle2), 4, 0.01, {
                        cycle: -0.5,
                        isWave: true,
                        endCycle: simulation.cycle + 40, // + 30 * me.tech.isPlasmaRange,
                        inertia: Infinity,
                        frictionAir: 0,
                        isInHole: true, //this keeps the bullet from entering wormholes
                        minDmgSpeed: 0,
                        dmg: 2.7, //damage also changes when you divide by mob.mass on in .do()
                        classType: "bullet",
                        isBranch: false,
                        restitution: 0,
                        collisionFilter: {
                            // category: 0,
                            // mask: 0, //cat.mob | cat.mobBullet | cat.mobShield
                            category: 0, //cat.bullet,
                            mask: 0, //cat.map, //cat.mob | cat.mobBullet | cat.mobShield
                        },
                        beforeDmg() { },
                        onEnd() { },
                        do() {
                            if (this.endCycle < simulation.cycle + 1) this.isWave = false
                            if (Matter.Query.point(map, this.position).length) { //check if inside map   //|| Matter.Query.point(body, this.position).length
                                this.isBranch = true;
                                this.do = () => {
                                    if (this.endCycle < simulation.cycle + 1) this.isWave = false
                                }
                            } else { //check if inside a mob
                                for (let i = 0, len = mob.length; i < len; i++) {
                                    const dist = Vector.magnitudeSquared(Vector.sub(this.position, mob[i].position))
                                    const radius = mob[i].radius + me.tech.extruderRange / 2
                                    if (dist < radius * radius && mob[i].id != me.id) {
                                        if (mob[i].speed > 2) {
                                            if (mob[i].isBoss || mob[i].isShielded) {
                                                Matter.Body.setVelocity(mob[i], { x: mob[i].velocity.x * 0.95, y: mob[i].velocity.y * 0.95 });
                                            } else {
                                                Matter.Body.setVelocity(mob[i], { x: mob[i].velocity.x * 0.25, y: mob[i].velocity.y * 0.25 });
                                            }
                                        }
                                        // Matter.Body.setPosition(this, Vector.add(this.position, mob[i].velocity)) //move with the medium
                                        let dmg = this.dmg / Math.min(10, mob[i].mass)
                                        mob[i].damage(dmg);
                                    }
                                }
                            }
                            this.cycle++
                            const wiggleMag = (me.crouch ? 6 : 12) * Math.cos(simulation.cycle * 0.09)
                            const wiggle = Vector.mult(transverse, wiggleMag * Math.cos(this.cycle * 0.36)) //+ wiggleMag * Math.cos(simulation.cycle * 0.3))
                            const velocity = Vector.mult(me.velocity, 0.4) //move with me
                            Matter.Body.setPosition(this, Vector.add(velocity, Vector.add(this.position, wiggle)))
                        }
                    });
                    Composite.add(engine.world, bullet[em]); //add bullet to world
                    Matter.Body.setVelocity(bullet[em], {
                        x: SPEED * Math.cos(me.angle2),
                        y: SPEED * Math.sin(me.angle2)
                    });
                    const transverse = Vector.normalise(Vector.perp(bullet[em].velocity))
                    if (180 - Math.abs(Math.abs(me.lastAngle - me.angle2) - 180) > 0.13 || !me.wasExtruderOn) {
                        bullet[em].isBranch = true; //don't draw stroke for this bullet
                        bullet[em].do = function () {
                            if (this.endCycle < simulation.cycle + 1) this.isWave = false
                        }
                    }
                    me.lastAngle = me.angle2 //track last angle for the above angle difference calculation
                } else {
                    me.canExtruderFire = false;
                }
            }
            me.plasma = function() {
                const DRAIN = 0.00075
                if (me.energy > DRAIN) {
                    me.energy -= DRAIN;
                    if (me.energy < 0) {
                        me.fieldCDcycle = me.cycle + 120;
                        me.energy = 0;
                    }

                    //calculate laser collision
                    let range = me.tech.isPlasmaRange * (120 + (me.crouch ? 400 : 300) * Math.sqrt(Math.random())) //+ 100 * Math.sin(me.cycle * 0.3);
                    // const dir = me.angle2 // + 0.04 * (Math.random() - 0.5)
                    const path = [
                        { x: me.pos.x + 20 * Math.cos(me.angle2), y: me.pos.y + 20 * Math.sin(me.angle2) },
                        { x: me.pos.x + range * Math.cos(me.angle2), y: me.pos.y + range * Math.sin(me.angle2) }
                    ];
                    //check for collisions
                    let best = {
                        x: null,
                        y: null,
                        dist2: Infinity,
                        who: null,
                        v1: null,
                        v2: null
                    };
                    const mobf = mob.filter(b => b.collisionFilter.group !== -me.id);
                    best = vertexCollision(path[0], path[1], [mobf, map, body, [player]]);
                    if (best.dist2 != Infinity) { //if hitting something
                        path[path.length - 1] = { x: best.x, y: best.y };
                        if (best.who.alive) {
                            const dmg = 0.9; //********** SCALE DAMAGE HERE *********************
                            best.who.damage(dmg);

                            //push mobs away
                            if (best.who.speed > 3) {
                                const force = Vector.mult(Vector.normalise(Vector.sub(me.pos, path[1])), -0.005 * Math.min(5, best.who.mass))
                                Matter.Body.applyForce(best.who, path[1], force)
                                Matter.Body.setVelocity(best.who, { x: best.who.velocity.x * 0.4, y: best.who.velocity.y * 0.4 });
                            } else {
                                const force = Vector.mult(Vector.normalise(Vector.sub(me.pos, path[1])), -0.01 * Math.min(5, best.who.mass))
                                Matter.Body.applyForce(best.who, path[1], force)
                                Matter.Body.setVelocity(best.who, { x: best.who.velocity.x * 0.7, y: best.who.velocity.y * 0.7 });
                            }
                            //draw mob damage circle
                            simulation.drawList.push({
                                x: path[1].x,
                                y: path[1].y,
                                radius: Math.sqrt(2000 * dmg * best.who.damageReduction),
                                color: "rgba(255,0,255,0.2)",
                                time: simulation.drawTime * 4
                            });
                        } else if (!best.who.isStatic) {
                            //push blocks away
                            const force = Vector.mult(Vector.normalise(Vector.sub(me.pos, path[1])), -0.007 * Math.sqrt(Math.sqrt(best.who.mass)))
                            Matter.Body.applyForce(best.who, path[1], force)

                            if(best.who == player) {
                                simulation.drawList.push({
                                    x: path[1].x,
                                    y: path[1].y,
                                    radius: Math.sqrt(2000),
                                    color: "rgba(255,0,255,0.2)",
                                    time: simulation.drawTime * 4
                                });
                                if (best.who.speed > 3) {
                                    const force = Vector.mult(Vector.normalise(Vector.sub(me.pos, path[1])), -0.005 * Math.min(5, best.who.mass))
                                    Matter.Body.applyForce(best.who, path[1], force)
                                    Matter.Body.setVelocity(best.who, { x: best.who.velocity.x * 0.4, y: best.who.velocity.y * 0.4 });
                                } else {
                                    const force = Vector.mult(Vector.normalise(Vector.sub(me.pos, path[1])), -0.01 * Math.min(5, best.who.mass))
                                    Matter.Body.applyForce(best.who, path[1], force)
                                    Matter.Body.setVelocity(best.who, { x: best.who.velocity.x * 0.7, y: best.who.velocity.y * 0.7 });
                                }
                            }
                        }
                    }

                    //draw blowtorch laser beam
                    ctx.strokeStyle = "rgba(255,0,255,0.1)"
                    ctx.lineWidth = 14
                    ctx.beginPath();
                    ctx.moveTo(path[0].x, path[0].y);
                    ctx.lineTo(path[1].x, path[1].y);
                    ctx.stroke();
                    ctx.strokeStyle = "#f0f";
                    ctx.lineWidth = 2
                    ctx.stroke();

                    //draw electricity
                    const Dx = Math.cos(me.angle2);
                    const Dy = Math.sin(me.angle2);
                    let x = me.pos.x + 20 * Dx;
                    let y = me.pos.y + 20 * Dy;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    const step = Vector.magnitude(Vector.sub(path[0], path[1])) / 10
                    for (let i = 0; i < 8; i++) {
                        x += step * (Dx + 1.5 * (Math.random() - 0.5))
                        y += step * (Dy + 1.5 * (Math.random() - 0.5))
                        ctx.lineTo(x, y);
                    }
                    ctx.lineWidth = 2 * Math.random();
                    ctx.stroke();
                }
            }
            me.endoThermic = function(drain) {
                if (me.tech.isEndothermic) {
                    const len = 10 * drain
                    if (Math.random() < len) {
                        for (let i = 0; i < len; i++) {
                            b2.iceIX(1, me.angle2 + Math.PI * 2 * Math.random(), {
                                x: me.pos.x + 30 * Math.cos(me.angle2),
                                y: me.pos.y + 30 * Math.sin(me.angle2)
                            }, me.id)
                        }
                    }
                }
            }
            me.printBlock = function() {
                const sides = Math.floor(4 + 6 * Math.random() * Math.random())
                body[body.length] = Matter.Bodies.polygon(me.pos.x, me.pos.y, sides, 8, {
                    friction: 0.05,
                    frictionAir: 0.001,
                    collisionFilter: { category: 0, mask: 0 }, //no collision because player is holding
                    classType: "body",
                    isPrinted: true,
                    radius: 10, //used to grow and warp the shape of the block
                    density: 0.002, //double density for 2x damage
                });
                const who = body[body.length - 1]
                Composite.add(engine.world, who); 
                me.throwCharge = 4;
                me.holdingTarget = who
                me.isHolding = true;
                me.endoThermic(0.4)
            }
            me.fieldPosition = { x: me.pos.x, y: me.pos.y }
            me.fieldAngle = me.angle2;
            me.fieldDrawRadius = 0;
            me.oldField = 0;
            me.fieldPhase = 0;
            me.sneakAttackCycle = 0;
            me.enterCloakCycle = 0;
            me.lastFieldPosition = { x: me.mouse.x, y: me.mouse.y }
            me.fieldRadius = 0;
            me.fieldOn = false;
            me.pilotWaveCollider = null;
            me.fieldMass = 1;
            me.drain = 1
            me.isRewindMode = false;
            me.isRewinding = false;
            me.isTimeDilated = false;
            me.molecularMode = 0;
			me.do = function () {
				this.cycle++;
                if(me.level != level.onLevel) return;
				me.pos.x = this.position.x;
				me.pos.y = mobBody.position.y - this.yOff;
				me.Vx = this.velocity.x;
				me.Vy = this.velocity.y;
				this.force.y += this.mass * simulation.g;
				if (!me.isCloak) {
                    me.draw();
                    const h = m.radius * 0.3;
                    const w = m.radius * 2;
                    const x = me.position.x - w / 2;
                    const y = me.pos.y - 50;
                    ctx.fillStyle = "rgba(100, 100, 100, 0.3)";
                    ctx.fillRect(x, y, w, h);
                    ctx.fillStyle = "rgba(255,0,0,0.7)";
                    ctx.fillRect(x, y, w * (me.health / me.maxHealth), h);

                    me.crosshair.x = lerp(me.crosshair.x, me.mouse.x, 0.2);
                    me.crosshair.y = lerp(me.crosshair.y, me.mouse.y, 0.2);

                    const size = 10;
                    ctx.beginPath();
                    ctx.moveTo(me.crosshair.x - size, me.crosshair.y);
                    ctx.lineTo(me.crosshair.x + size, me.crosshair.y);
                    ctx.moveTo(me.crosshair.x, me.crosshair.y - size);
                    ctx.lineTo(me.crosshair.x, me.crosshair.y + size);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "#000000"; // "rgba(0,0,0,0.4)"
                    ctx.stroke();
                    
                    me.lastTextPos.x = lerp(me.lastTextPos.x, me.position.x, 0.5);
                    me.lastTextPos.y = lerp(me.lastTextPos.y, me.pos.y - 70, 0.5);
                    ctx.fillStyle = "#000";
                    ctx.font = "30px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText(me.username, me.lastTextPos.x, me.lastTextPos.y);
                }
                me.history.splice(simulation.cycle % 600, 1, {
                    position: {
                        x: me.position.x,
                        y: me.position.y,
                    },
                    velocity: {
                        x: me.velocity.x,
                        y: me.velocity.y
                    },
                    yOff: me.yOff,
                    angle: me.angle2,
                    health: me.health,
                    energy: me.energy,
                    activeGun: me.activeGun
                });
				if (me.onGround) {
					me.groundControl();
				} else {
					me.airControl();
				}
                if (me.fieldMode == 0) {
                    me.grabPowerUpRange2 = 200000;
                    if (me.isHolding) {
                        me.drawHold(me.holdingTarget);
                        me.holding();
                        me.throwBlockDefault();
                    } else if (me.inputField && me.fieldCDcycle < me.cycle) {
                        if (me.energy > me.fieldRegen) me.energy -= me.fieldRegen;
                            me.grabPowerUp();
                            me.lookForBlock();
                        if (me.energy > me.minEnergyToDeflect) {
                            me.drawField();
                            me.pushMobsFacing();
                        }
                    } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) {
                        me.pickUp(); 
                    } else {
                        me.holdingTarget = null;
                    }
                } else if (me.fieldMode == 1) {
                    me.blockingRecoil = 1 //4 is normal
                    me.grabPowerUpRange2 = 200000;
                    me.fieldRange = 185
                    me.fieldShieldingScale = 1.6 * Math.pow(0.5, (me.tech.harmonics - 2))
                    if (me.isHolding) {
                        me.drawHold(me.holdingTarget);
                        me.holding();
                        me.throwBlockDefault();
                    } else if ((me.inputField) && me.fieldCDcycle < me.cycle) { //not hold but field button is pressed
                        if (me.energy > me.fieldRegen) me.energy -= me.fieldRegen
                        me.grabPowerUp();
                        me.lookForBlock();
                    } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) { //holding, but field button is released
                        me.pickUp();
                    } else {
                        me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                    }
                    if (me.energy > me.minEnergyToDeflect && me.fieldCDcycle < me.cycle) {
                        if (me.tech.isStandingWaveExpand) {
                            if (me.inputField) {
                                // const oldHarmonicRadius = me.harmonicRadius
                                me.harmonicRadius = 0.99 * me.harmonicRadius + 0.01 * 4
                                // me.energy -= 0.1 * (me.harmonicRadius - oldHarmonicRadius)
                            } else {
                                me.harmonicRadius = 0.994 * me.harmonicRadius + 0.006
                            }
                        }
                        if (!simulation.isTimeSkipping) {
                            if (me.tech.harmonics === 2) {
                                me.harmonicShield = me.harmonic3Phase
                            } else {
                                me.harmonicShield = me.harmonicAtomic
                            }
                            me.harmonicShield();
                        }
                    }
                } else if (me.fieldMode == 2) {
                    me.fieldShieldingScale = 0;
                    me.fieldBlockCD = 3;
                    me.grabPowerUpRange2 = 10000000;
                    const wave = Math.sin(me.cycle * 0.022);
                    me.fieldRange = 180 + 12 * wave + 100 * me.tech.isBigField
                    me.fieldArc = 0.35 + 0.045 * wave + 0.065 * me.tech.isBigField //run calculateFieldThreshold after setting fieldArc, used for powerUp grab and mobPush with lookingAt(mob)
                    me.calculateFieldThreshold();
                    if (me.isHolding) {
                        me.drawHold(me.holdingTarget);
                        me.holding();
                        me.throwBlockDefault();
                    } else if (me.inputField) { //not hold but field button is pressed
                        //float while field is on
                        const angleReduction = 0.5 + 0.7 * (Math.PI / 2 - Math.min(Math.PI / 2, Math.abs(me.angle2 + Math.PI / 2)))
                        // console.log(angleReduction)
                        if (me.velocity.y > 1) {
                            me.force.y -= angleReduction * (me.tech.isBigField ? 0.95 : 0.5) * me.mass * simulation.g;

                            const pushX = 0.0007 * angleReduction * me.mass
                            if (me.velocity.x > 0.5) {
                                me.force.x += pushX
                            } else if (me.velocity.x < -0.5) {
                                me.force.x -= pushX
                            }

                            Matter.Body.setVelocity(me, {
                                x: me.velocity.x,
                                y: 0.98 * me.velocity.y
                            });

                            //set velocity to cap, but keep the direction
                            // capX = 28
                            // Matter.Body.setVelocity(player, {
                            //     x: Math.abs(me.velocity.x) < capX ? Math.max(-capX, Math.min(1.0155 * me.velocity.x, capX)) : me.velocity.x,
                            //     y: 0.98 * me.velocity.y
                            // }); 
                        }

                        // go invulnerable while field is active, but also drain energy
                        // if (true && me.energy > 2 * me.fieldRegen && me.immuneCycle < me.cycle + me.tech.cyclicImmunity) {
                        //     me.immuneCycle = me.cycle + 1; //player is immune to damage for 60 cycles
                        //     me.energy -= 2 * me.fieldRegen
                        //     if (me.energy < me.fieldRegen) me.fieldCDcycle = me.cycle + 90;
                        // }

                        if (me.energy > me.fieldRegen) me.energy -= me.fieldRegen
                        me.grabPowerUp();
                        me.lookForBlock();
                        me.fieldPosition = { x: me.pos.x, y: me.pos.y }
                        me.fieldAngle = me.angle2
                        //draw field attached to player
                        if (me.holdingTarget) {
                            ctx.fillStyle = `rgba(110,150,220, ${0.06 + 0.03 * Math.random()})`
                            ctx.strokeStyle = `rgba(110,150,220, ${0.35 + 0.05 * Math.random()})`
                        } else {
                            ctx.fillStyle = `rgba(110,150,220, ${0.27 + 0.2 * Math.random() - 0.1 * wave})`
                            ctx.strokeStyle = `rgba(110,150,220, ${0.4 + 0.5 * Math.random()})`
                        }
                        ctx.beginPath();
                        ctx.arc(me.pos.x, me.pos.y, me.fieldRange, me.angle2 - Math.PI * me.fieldArc, me.angle2 + Math.PI * me.fieldArc, false);
                        ctx.lineWidth = 2.5 - 1.5 * wave;
                        ctx.stroke();
                        const curve = 0.57 + 0.04 * wave
                        const aMag = (1 - curve * 1.2) * Math.PI * me.fieldArc
                        let a = me.angle2 + aMag
                        let cp1x = me.pos.x + curve * me.fieldRange * Math.cos(a)
                        let cp1y = me.pos.y + curve * me.fieldRange * Math.sin(a)
                        ctx.quadraticCurveTo(cp1x, cp1y, me.pos.x + 30 * Math.cos(me.angle2), me.pos.y + 30 * Math.sin(me.angle2))
                        a = me.angle2 - aMag
                        cp1x = me.pos.x + curve * me.fieldRange * Math.cos(a)
                        cp1y = me.pos.y + curve * me.fieldRange * Math.sin(a)
                        ctx.quadraticCurveTo(cp1x, cp1y, me.pos.x + 1 * me.fieldRange * Math.cos(me.angle2 - Math.PI * me.fieldArc), me.pos.y + 1 * me.fieldRange * Math.sin(me.angle2 - Math.PI * me.fieldArc))
                        ctx.fill();
                        me.perfectPush();
                    } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) { //holding, but field button is released
                        me.pickUp();
                    } else {
                        me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                        if (!me.inputField) { //&& me.tech.isFieldFree
                            //draw field free of player
                            ctx.fillStyle = `rgba(110,150,220, ${0.27 + 0.2 * Math.random() - 0.1 * wave})`
                            ctx.strokeStyle = `rgba(110,180,255, ${0.4 + 0.5 * Math.random()})`
                            ctx.beginPath();
                            ctx.arc(me.fieldPosition.x, me.fieldPosition.y, me.fieldRange, me.fieldAngle - Math.PI * me.fieldArc, me.fieldAngle + Math.PI * me.fieldArc, false);
                            ctx.lineWidth = 2.5 - 1.5 * wave;
                            ctx.stroke();
                            const curve = 0.8 + 0.06 * wave
                            const aMag = (1 - curve * 1.2) * Math.PI * me.fieldArc
                            let a = me.fieldAngle + aMag
                            ctx.quadraticCurveTo(me.fieldPosition.x + curve * me.fieldRange * Math.cos(a), me.fieldPosition.y + curve * me.fieldRange * Math.sin(a), me.fieldPosition.x + 1 * me.fieldRange * Math.cos(me.fieldAngle - Math.PI * me.fieldArc), me.fieldPosition.y + 1 * me.fieldRange * Math.sin(me.fieldAngle - Math.PI * me.fieldArc))
                            ctx.fill();
                            me.perfectPush(true);
                        }
                    }
                    if (me.tech.isPerfectBrake) { //cap mob speed around player
                        const range = 200 + 140 * wave + 150 * me.energy
                        for (let i = 0; i < mob.length; i++) {
                            const distance = Vector.magnitude(Vector.sub(me.pos, mob[i].position))
                            if (distance < range && mob[i].id != me.id) {
                                const cap = mob[i].isShielded ? 8 : 4
                                if (mob[i].speed > cap && Vector.dot(mob[i].velocity, Vector.sub(me.pos, mob[i].position)) > 0) { // if velocity is directed towards player
                                    Matter.Body.setVelocity(mob[i], Vector.mult(Vector.normalise(mob[i].velocity), cap)); //set velocity to cap, but keep the direction
                                }
                            }
                        }
                        const distance = Vector.magnitude(Vector.sub(me.pos, mob[i].position))
                        if (distance < range) {
                            if (player.speed > cap && Vector.dot(player.velocity, Vector.sub(me.pos, player.position)) > 0) { // if velocity is directed towards player
                                Matter.Body.setVelocity(player, Vector.mult(Vector.normalise(player.velocity), cap)); //set velocity to cap, but keep the direction
                            }
                        }
                        ctx.beginPath();
                        ctx.arc(me.pos.x, me.pos.y, range, 0, 2 * Math.PI);
                        ctx.fillStyle = "hsla(200,50%,61%,0.08)";
                        ctx.fill();
                    }
                } else if (me.fieldMode == 3) {
                    me.holdingMassScale = 0.01;
                    me.grabPowerUpRange2 = 200000;
                    me.airSpeedLimit = 125 //5 * me.mass * me.mass
                    me.FxAir = 0.016
                    if (me.isHolding) {
                        me.drawHold(me.holdingTarget);
                        me.holding();
                        me.throwBlockDefault();
                    } else if (me.inputField) { //push away
                        if (me.energy > me.fieldRegen && me.tech.negativeMassCost > 0) me.energy -= me.fieldRegen
                        me.grabPowerUp();
                        me.lookForBlock();
                        if (me.energy > 0 && me.fieldCDcycle < me.cycle) {
                            if (me.tech.isFlyFaster) {
                                //look for nearby objects to make zero-g
                                function moveThis(who, range, mag = 1.06) {
                                    for (let i = 0, len = who.length; i < len; ++i) {
                                        sub = Vector.sub(who[i].position, me.pos);
                                        dist = Vector.magnitude(sub);
                                        if (dist < range) {
                                            who[i].force.y -= who[i].mass * (simulation.g * mag); //add a bit more then standard gravity
                                            if (me.inputLeft) { //blocks move horizontally with the same force as the me
                                                who[i].force.x -= me.FxAir * who[i].mass / 10; // move me   left / a
                                            } else if (me.inputRight) {
                                                who[i].force.x += me.FxAir * who[i].mass / 10; //move me  right / d
                                            }
                                        }
                                    }
                                }
                                //control horizontal acceleration
                                me.airSpeedLimit = 1000 // 7* me.mass * me.mass
                                me.FxAir = 0.01
                                //control vertical acceleration
                                if (me.inputDown) { //down
                                    me.force.y += 0.5 * me.mass * simulation.g;
                                    this.fieldDrawRadius = this.fieldDrawRadius * 0.97 + 500 * 0.03;
                                    moveThis(powerUp, this.fieldDrawRadius, 0);
                                    moveThis(body, this.fieldDrawRadius, 0);
                                } else if (me.inputUp) { //up
                                    me.energy -= 5 * me.tech.negativeMassCost;
                                    this.fieldDrawRadius = this.fieldDrawRadius * 0.97 + 1100 * 0.03;
                                    me.force.y -= 2.25 * me.mass * simulation.g;
                                    moveThis(powerUp, this.fieldDrawRadius, 1.8);
                                    moveThis(body, this.fieldDrawRadius, 1.8);
                                } else {
                                    me.energy -= me.tech.negativeMassCost;
                                    this.fieldDrawRadius = this.fieldDrawRadius * 0.97 + 800 * 0.03;
                                    me.force.y -= 1.07 * me.mass * simulation.g; // slow upward drift
                                    moveThis(powerUp, this.fieldDrawRadius);
                                    moveThis(body, this.fieldDrawRadius);
                                }
                            } else {
                                //look for nearby objects to make zero-g
                                function verticalForce(who, range, mag = 1.06) {
                                    for (let i = 0, len = who.length; i < len; ++i) {
                                        sub = Vector.sub(who[i].position, me.pos);
                                        dist = Vector.magnitude(sub);
                                        if (dist < range) {
                                            who[i].force.y -= who[i].mass * (simulation.g * mag); //add a bit more then standard gravity
                                            if (me.inputLeft) { //blocks move horizontally with the same force as the me
                                                who[i].force.x -= me.FxAir * who[i].mass / 10; // move me   left / a
                                            } else if (me.inputRight) {
                                                who[i].force.x += me.FxAir * who[i].mass / 10; //move me  right / d
                                            }
                                        }



                                        // sub = Vector.sub(who[i].position, me.pos);
                                        // dist = Vector.magnitude(sub);
                                        // if (dist < range) who[i].force.y -= who[i].mass * (simulation.g * mag);
                                    }
                                }
                                //control horizontal acceleration
                                me.airSpeedLimit = 400 // 7* me.mass * me.mass
                                me.FxAir = 0.005
                                //control vertical acceleration
                                if (me.inputDown) { //down
                                    me.force.y -= 0.5 * me.mass * simulation.g;
                                    this.fieldDrawRadius = this.fieldDrawRadius * 0.97 + 400 * 0.03;
                                    verticalForce(powerUp, this.fieldDrawRadius, 0.7);
                                    verticalForce(body, this.fieldDrawRadius, 0.7);
                                } else if (me.inputUp) { //up
                                    me.energy -= 5 * me.tech.negativeMassCost;
                                    this.fieldDrawRadius = this.fieldDrawRadius * 0.97 + 850 * 0.03;
                                    me.force.y -= 1.45 * me.mass * simulation.g;
                                    verticalForce(powerUp, this.fieldDrawRadius, 1.38);
                                    verticalForce(body, this.fieldDrawRadius, 1.38);
                                } else {
                                    me.energy -= me.tech.negativeMassCost;
                                    this.fieldDrawRadius = this.fieldDrawRadius * 0.97 + 650 * 0.03;
                                    me.force.y -= 1.07 * me.mass * simulation.g; // slow upward drift
                                    verticalForce(powerUp, this.fieldDrawRadius);
                                    verticalForce(body, this.fieldDrawRadius);
                                }
                            }

                            if (me.energy < 0) {
                                me.fieldCDcycle = me.cycle + 120;
                                me.energy = 0;
                            }
                            //add extra friction for horizontal motion
                            if (me.inputDown || me.inputUp || me.inputLeft || me.inputRight) {
                                Matter.Body.setVelocity(me, { x: me.velocity.x * 0.99, y: me.velocity.y * 0.98 });
                            } else { //slow rise and fall
                                Matter.Body.setVelocity(me, { x: me.velocity.x * 0.99, y: me.velocity.y * 0.98 });
                            }
                            //draw zero-G range
                            if (!simulation.isTimeSkipping) {
                                ctx.beginPath();
                                ctx.arc(me.pos.x, me.pos.y, this.fieldDrawRadius, 0, 2 * Math.PI);
                                ctx.fillStyle = "#f5f5ff";
                                ctx.globalCompositeOperation = "difference";
                                ctx.fill();
                                ctx.globalCompositeOperation = "source-over";
                            }
                        }
                    } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) { 
                        me.pickUp();
                        this.fieldDrawRadius = 0
                    } else {
                        me.holdingTarget = null;
                        this.fieldDrawRadius = 0
                    }
                } else if (me.fieldMode == 4) {
                    if (me.energy > me.maxEnergy - 0.02 && me.fieldCDcycle < me.cycle && !me.inputField && bullet.length < 300 && (me.cycle % 2)) {
                        if (me.molecularMode === 0) {
                            if (me.tech.isSporeFlea) {
                                const drain = 0.18 + (Math.max(bullet.length, 130) - 130) * 0.02
                                if (me.energy > drain) {
                                    me.energy -= drain
                                    const speed = me.crouch ? 20 + 8 * Math.random() : 10 + 3 * Math.random()
                                    b2.flea({
                                        x: me.pos.x + 35 * Math.cos(me.angle2),
                                        y: me.pos.y + 35 * Math.sin(me.angle2)
                                    }, {
                                        x: speed * Math.cos(me.angle2),
                                        y: speed * Math.sin(me.angle2)
                                    }, 6 + 3 * Math.random() + 10 * me.tech.wormSize * Math.random(), me.id)
                                    me.endoThermic(drain)
                                }
                            } else if (me.tech.isSporeWorm) {
                                const drain = 0.18 + (Math.max(bullet.length, 130) - 130) * 0.02
                                if (me.energy > drain) {
                                    me.energy -= drain
                                    b2.worm({
                                        x: me.pos.x + 35 * Math.cos(me.angle2),
                                        y: me.pos.y + 35 * Math.sin(me.angle2)
                                    }, me.tech.isSporeFlea, me.id)
                                    const SPEED = 2 + 1 * Math.random();
                                    Matter.Body.setVelocity(bullet[bullet.length - 1], {
                                        x: SPEED * Math.cos(me.angle2),
                                        y: SPEED * Math.sin(me.angle2)
                                    });
                                    me.endoThermic(drain)
                                }
                            } else {
                                const drain = 0.095 + (Math.max(bullet.length, 130) - 130) * 0.01
                                for (let i = 0, len = 5; i < len; i++) {
                                    if (me.energy > 3 * drain) {
                                        me.energy -= drain
                                        const unit = Vector.rotate({ x: 1, y: 0 }, 6.28 * Math.random())
                                        b2.spore(Vector.add(me.pos, Vector.mult(unit, 25)), Vector.mult(unit, 10), me.id)
                                        me.endoThermic(drain)
                                    } else {
                                        break
                                    }
                                }
                            }
                        } else if (me.molecularMode === 1) {
                            const drain = 0.33
                            me.energy -= drain;
                            const direction = { x: Math.cos(me.angle2), y: Math.sin(me.angle2) }
                            const push = Vector.mult(Vector.perp(direction), 0.08)
                            b2.missile({ x: me.pos.x + 30 * direction.x, y: me.pos.y + 30 * direction.y }, me.angle2, -15, 1, me.id)
                            bullet[bullet.length - 1].force.x += push.x * (Math.random() - 0.5)
                            bullet[bullet.length - 1].force.y += 0.005 + push.y * (Math.random() - 0.5)
                            // b2.missile({ x: me.pos.x, y: me.pos.y - 40 }, -Math.PI / 2 + 0.5 * (Math.random() - 0.5), 0, 1)
                            me.endoThermic(drain)
                        } else if (me.molecularMode === 2) {
                            const drain = 0.04
                            me.energy -= drain;
                            b2.iceIX(1, me.angle2 + Math.PI * 2 * Math.random(), {
                                x: me.pos.x + 30 * Math.cos(me.angle2),
                                y: me.pos.y + 30 * Math.sin(me.angle2)
                            }, me.id)
                            me.endoThermic(drain)
                        } else if (me.molecularMode === 3) {
                            if (me.tech.isDroneRadioactive) {
                                const drain = 0.8 + (Math.max(bullet.length, 50) - 50) * 0.01
                                if (me.energy > drain) {
                                    me.energy -= drain
                                    b2.droneRadioactive({
                                        x: me.pos.x + 30 * Math.cos(me.angle2) + 10 * (Math.random() - 0.5),
                                        y: me.pos.y + 30 * Math.sin(me.angle2) + 10 * (Math.random() - 0.5)
                                    }, 25, me.id)
                                    me.endoThermic(drain)
                                }
                            } else {
                                //every bullet above 100 adds 0.005 to the energy cost per drone
                                //at 200 bullets the energy cost is 0.45 + 100*0.006 = 1.05
                                const drain = (0.45 + (Math.max(bullet.length, 100) - 100) * 0.006) * me.tech.droneEnergyReduction
                                if (me.energy > drain) {
                                    me.energy -= drain
                                    b2.drone({ x: me.pos.x + 30 * Math.cos(me.angle2) + 20 * (Math.random() - 0.5), y: me.pos.y + 30 * Math.sin(me.angle2) + 20 * (Math.random() - 0.5) }, 1, me.id)
                                    me.endoThermic(drain)
                                }
                            }
                        }
                    }
                    if (me.isHolding) {
                        me.drawHold(me.holdingTarget);
                        me.holding();
                        if (me.tech.isPrinter && me.holdingTarget.isPrinted && me.inputField) {
                            // if (Math.random() < 0.004 && me.holdingTarget.vertices.length < 12) me.holdingTarget.vertices.push({ x: 0, y: 0 }) //small chance to increase the number of vertices
                            me.holdingTarget.radius += Math.min(1.1, 1.3 / me.holdingTarget.mass) //grow up to a limit
                            const r1 = me.holdingTarget.radius * (1 + 0.12 * Math.sin(me.cycle * 0.11))
                            const r2 = me.holdingTarget.radius * (1 + 0.12 * Math.cos(me.cycle * 0.11))
                            let angle = (me.cycle * 0.01) % (2 * Math.PI) //rotate the object 
                            let vertices = []
                            for (let i = 0, len = me.holdingTarget.vertices.length; i < len; i++) {
                                angle += 2 * Math.PI / len
                                vertices.push({ x: me.holdingTarget.position.x + r1 * Math.cos(angle), y: me.holdingTarget.position.y + r2 * Math.sin(angle) })
                            }
                            Matter.Body.setVertices(me.holdingTarget, vertices)
                            me.definePlayerMass(me.defaultMass + me.holdingTarget.mass * me.holdingMassScale)
                        }
                        me.throwBlockDefault();
                    } else if ((me.inputField && me.fieldCDcycle < me.cycle)) { //not hold but field button is pressed
                        if (me.energy > me.fieldRegen) me.energy -= me.fieldRegen
                        me.grabPowerUp();
                        me.lookForBlock();
                        if (me.tech.isPrinter && me.inputDown) {
                            me.printBlock();
                        } else if (me.energy > me.minEnergyToDeflect) {
                            me.drawField();
                            me.pushMobsFacing();
                        }
                    } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) { //holding, but field button is released
                        me.pickUp();
                    } else {
                        me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                    }
                } else if (me.fieldMode == 5) {
                    if (me.tech.isPlasmaBall) {
                        if(!me.plasmaBall) {
                            me.plasmaBall = Bodies.circle(me.pos.x + 10 * Math.cos(me.angle2), me.pos.y + 10 * Math.sin(me.angle2), 1, {
                                isSensor: true,
                                frictionAir: 0,
                                alpha: 0.7,
                                isAttached: false,
                                isOn: false,
                                drain: 0.0018,
                                radiusLimit: 10,
                                damage: 0.7,
                                effectRadius: 10,
                                setPositionToNose() {
                                    const r = 27
                                    const nose = { x: me.pos.x + r * Math.cos(me.angle2), y: me.pos.y + r * Math.sin(me.angle2) }
                                    me.plasmaBall.effectRadius = 2 * me.plasmaBall.circleRadius
                                    Matter.Body.setPosition(this, Vector.add(nose, Vector.mult(Vector.normalise(Vector.sub(nose, me.pos)), this.effectRadius)));
                                },
                                fire() {
                                    const drain = 0.06
                                    if (me.energy > drain) me.energy -= drain
                                    this.isAttached = false;
                                    const speed = 5 + Math.min(15, 80 / this.mass) //scale speed with mass
                                    Matter.Body.setVelocity(this, {
                                        x: me.velocity.x * 0.4 + speed * Math.cos(me.angle2),
                                        y: speed * Math.sin(me.angle2)
                                    });
                                    me.plasmaBall.setPositionToNose()
                                },
                                scale(scale) {
                                    if (this.circleRadius > this.radiusLimit) Matter.Body.scale(me.plasmaBall, scale, scale); //shrink fast
                                },
                                reset() {
                                    const scale = 1 / this.circleRadius
                                    Matter.Body.scale(this, scale, scale); //grow
                                    this.alpha = 0.7
                                    this.isOn = false
                                    // this.isAttached = true;
                                },
                                do() {
                                    if (this.isOn) {
                                        this.effectRadius = 2 * me.plasmaBall.circleRadius * (0.6 + 0.4 * me.tech.isPlasmaRange)

                                        if (Matter.Query.collides(this, map).length > 0) {
                                            if (this.isAttached) {
                                                this.scale(Math.max(0.9, 0.99 - 0.1 / this.circleRadius))
                                            } else {
                                                me.plasmaBall.explode()
                                                Matter.Body.setVelocity(this, { x: 0, y: 0 });
                                                this.reset()
                                            }
                                        }

                                        //damage nearby mobs
                                        const dmg = this.damage * ((me.tech.isControlPlasma && !this.isAttached) ? 2 : 1)
                                        const arcList = []
                                        const dischargeRange = 150 + 1600 * me.tech.plasmaDischarge + 1.3 * this.effectRadius
                                        for (let i = 0, len = mob.length; i < len; i++) {
                                            if (mob[i].alive && (!mob[i].isBadTarget || mob[i].isMobBullet || mob[i].id != me.id) && !mob[i].isInvulnerable) {
                                                const sub = Vector.magnitude(Vector.sub(this.position, mob[i].position))
                                                if (sub < this.effectRadius + mob[i].radius) {
                                                    mob[i].damage(dmg);
                                                    if (mob[i].speed > 5) {
                                                        Matter.Body.setVelocity(mob[i], { x: mob[i].velocity.x * 0.6, y: mob[i].velocity.y * 0.6 });
                                                    } else {
                                                        Matter.Body.setVelocity(mob[i], { x: mob[i].velocity.x * 0.93, y: mob[i].velocity.y * 0.93 });
                                                    }
                                                } else if (sub < dischargeRange + mob[i].radius && Matter.Query.ray(map, mob[i].position, this.position).length === 0) {
                                                    arcList.push(mob[i]) //populate electrical arc list
                                                }
                                            }
                                        }
                                        const sub2 = Vector.magnitude(Vector.sub(this.position, player.position))
                                        if (sub2 < this.effectRadius + m.radius) {
                                            if (player.speed > 5) {
                                                Matter.Body.setVelocity(player, { x: player.velocity.x * 0.6, y: player.velocity.y * 0.6 });
                                            } else {
                                                Matter.Body.setVelocity(player, { x: player.velocity.x * 0.93, y: player.velocity.y * 0.93 });
                                            }
                                        }
                                        for (let i = 0; i < arcList.length; i++) {
                                            if (me.tech.plasmaDischarge > Math.random()) {
                                                const who = arcList[Math.floor(Math.random() * arcList.length)]
                                                who.damage(dmg * 4);
                                                //draw arcs
                                                const sub = Vector.sub(who.position, this.position)
                                                const unit = Vector.normalise(sub)
                                                let len = 12
                                                const step = Vector.magnitude(sub) / (len + 2)
                                                let x = this.position.x
                                                let y = this.position.y
                                                ctx.beginPath();
                                                ctx.moveTo(x, y);
                                                for (let i = 0; i < len; i++) {
                                                    x += step * (unit.x + (Math.random() - 0.5))
                                                    y += step * (unit.y + (Math.random() - 0.5))
                                                    ctx.lineTo(x, y);
                                                }
                                                ctx.lineTo(who.position.x, who.position.y);
                                                ctx.strokeStyle = "#88f";
                                                ctx.lineWidth = 6 + 3 * Math.random();
                                                ctx.stroke();
                                                if (who.damageReduction) {
                                                    simulation.drawList.push({
                                                        x: who.position.x,
                                                        y: who.position.y,
                                                        radius: 15,
                                                        color: "rgba(150,150,255,0.4)",
                                                        time: 15
                                                    });
                                                }
                                            }
                                        }

                                        //graphics
                                        const radius = this.effectRadius * (0.99 + 0.02 * Math.random()) + 3 * Math.random()
                                        const gradient = ctx.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, radius);
                                        const alpha = this.alpha + 0.15 * Math.random()
                                        const stop = 0.75 + 0.1 * Math.random()
                                        gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
                                        gradient.addColorStop(stop, `rgba(255,245,255,${alpha})`);
                                        gradient.addColorStop(stop + 0.1, `rgba(255,200,255,${alpha})`);
                                        gradient.addColorStop(1, `rgba(255,75,255,${alpha})`);
                                        // gradient.addColorStop(1, `rgba(255,150,255,${alpha})`);
                                        ctx.fillStyle = gradient
                                        ctx.beginPath();
                                        ctx.arc(this.position.x, this.position.y, radius, 0, 2 * Math.PI);
                                        ctx.fill();
                                        if (me.tech.isControlPlasma) {
                                            if (!this.isAttached) {
                                                //extra stroke to show 2x damage
                                                ctx.strokeStyle = "rgb(255, 0, 212)";
                                                ctx.lineWidth = Math.max(2, 0.04 * this.effectRadius);
                                                ctx.stroke();
                                            }
                                            //mouse control
                                            const mouseUnit = Vector.normalise(Vector.sub(simulation.mouseInGame, this.position))
                                            const speed = Vector.magnitude(this.velocity) //save current speed
                                            const push = Vector.mult(mouseUnit, 0.008 * Math.pow(speed, 1.8)) //roughly optimized to produce similar turing radius for different sizes
                                            Matter.Body.setVelocity(this, Vector.add(push, this.velocity));
                                            Matter.Body.setVelocity(this, Vector.mult(Vector.normalise(this.velocity), speed)); //keep speed constant
                                        }

                                        //draw arc from radius inward in a random walk
                                        ctx.beginPath();
                                        const unit = Vector.rotate({ x: 1, y: 0 }, Math.random() * 6.28)
                                        let where = Vector.add(this.position, Vector.mult(unit, 0.98 * radius))
                                        ctx.moveTo(where.x, where.y)
                                        const sub = Vector.normalise(Vector.sub(this.position, where))
                                        for (let i = 0, len = 7; i < len; i++) {
                                            const step = Vector.rotate(Vector.mult(sub, 17 * Math.random()), 2 * (Math.random() - 0.5))
                                            where = Vector.add(where, step)
                                            ctx.lineTo(where.x, where.y)
                                        }
                                        ctx.strokeStyle = "#88f";
                                        ctx.lineWidth = 0.5 + 2 * Math.random();
                                        ctx.stroke();
                                    }
                                },
                                explode() {
                                    simulation.ephemera.push({
                                        vertices: this.vertices,
                                        position: {
                                            x: me.plasmaBall.position.x,
                                            y: me.plasmaBall.position.y
                                        },
                                        radius: me.plasmaBall.effectRadius,
                                        alpha: 1,
                                        do() {
                                            // console.log(this.radius)
                                            //grow and fade
                                            this.radius *= 1.05
                                            this.alpha -= 0.05
                                            if (this.alpha < 0) simulation.removeEphemera(this)
                                            //graphics
                                            const radius = this.radius * (0.99 + 0.02 * Math.random()) + 3 * Math.random()
                                            const gradient = ctx.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, radius);
                                            const alpha = this.alpha + 0.15 * Math.random()
                                            const stop = 0.75 + 0.1 * Math.random()
                                            gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
                                            gradient.addColorStop(stop, `rgba(255,245,255,${alpha})`);
                                            gradient.addColorStop(stop + 0.1, `rgba(255,200,255,${alpha})`);
                                            gradient.addColorStop(1, `rgba(255,75,255,${alpha})`);
                                            // gradient.addColorStop(1, `rgba(255,150,255,${alpha})`);
                                            ctx.fillStyle = gradient
                                            ctx.beginPath();
                                            ctx.arc(this.position.x, this.position.y, radius, 0, 2 * Math.PI);
                                            ctx.fill();

                                            //damage nearby mobs
                                            const dmg = me.plasmaBall.damage
                                            for (let i = 0, len = mob.length; i < len; i++) {
                                                if (mob[i].alive && (!mob[i].isBadTarget || mob[i].isMobBullet) && !mob[i].isInvulnerable) {
                                                    const sub = Vector.magnitude(Vector.sub(this.position, mob[i].position))
                                                    if (sub < this.radius + mob[i].radius) {
                                                        mob[i].damage(dmg);
                                                    }
                                                }
                                            }

                                        },
                                    })
                                }
                            });
                            Composite.add(engine.world, me.plasmaBall);
                        }
                        if (me.isHolding) {
                            me.drawHold(me.holdingTarget);
                            me.holding();
                            me.throwBlockDefault();
                        } else if (me.inputField) { //not hold but field button is pressed
                            if (me.tech.isPlasmaBoost && powerUps.boost.endCycle < simulation.cycle + 60) powerUps.boost.endCycle = simulation.cycle + 60

                            if (me.energy > me.fieldRegen) me.energy -= me.fieldRegen
                            me.grabPowerUp();
                            me.lookForBlock();
                            if (me.fieldCDcycle < me.cycle) {
                                //field is active
                                if (!me.plasmaBall.isAttached) { //return ball to me
                                    if (me.plasmaBall.isOn) {
                                        me.plasmaBall.explode()
                                        me.plasmaBall.reset()
                                    } else {
                                        me.plasmaBall.isAttached = true
                                        me.plasmaBall.isOn = true
                                        me.plasmaBall.alpha = 0.7
                                        me.plasmaBall.setPositionToNose()

                                    }
                                } else if (me.energy > me.plasmaBall.drain) { //charge up when attached
                                    if (me.tech.isCapacitor) {
                                        me.energy -= me.plasmaBall.drain * 2;
                                        const scale = 1 + 48 * Math.pow(Math.max(1, me.plasmaBall.circleRadius), -1.8)
                                        Matter.Body.scale(me.plasmaBall, scale, scale); //grow
                                    } else {
                                        me.energy -= me.plasmaBall.drain;
                                        const scale = 1 + 16 * Math.pow(Math.max(1, me.plasmaBall.circleRadius), -1.8)
                                        Matter.Body.scale(me.plasmaBall, scale, scale); //grow    
                                    }
                                    if (me.energy > me.maxEnergy) {
                                        me.energy -= me.plasmaBall.drain * 2;
                                        const scale = 1 + 16 * Math.pow(Math.max(1, me.plasmaBall.circleRadius), -1.8)
                                        Matter.Body.scale(me.plasmaBall, scale, scale); //grow    
                                    }
                                    me.plasmaBall.setPositionToNose()

                                    //float
                                    const slowY = (me.velocity.y > 0) ? Math.max(0.5, 1 - 0.006 * me.velocity.y * me.velocity.y) : Math.max(0.997, 1 - 0.001 * Math.abs(me.velocity.y)) //down : up
                                    Matter.Body.setVelocity(me, {
                                        x: Math.max(0.95, 1 - 0.002 * Math.abs(me.velocity.x)) * me.velocity.x,
                                        y: slowY * me.velocity.y
                                    });
                                    if (me.velocity.y > 5) {
                                        me.force.y -= 0.9 * me.mass * simulation.g //less gravity when falling fast
                                    } else {
                                        me.force.y -= 0.5 * me.mass * simulation.g;
                                    }
                                } else {
                                    // me.fieldCDcycle = me.cycle + 60;
                                    me.plasmaBall.fire()
                                }
                            }
                        } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) { //holding, but field button is released
                            me.pickUp();
                            if (me.plasmaBall.isAttached) {
                                // me.fieldCDcycle = me.cycle;
                                me.plasmaBall.fire()
                            }
                        } else {
                            me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                            if (me.plasmaBall.isAttached) {
                                // me.fieldCDcycle = me.cycle;
                                me.plasmaBall.fire()
                            }
                        }
                        me.plasmaBall.do()
                    } else if (me.tech.isExtruder) {
                        me.isExtruderOn = false
                        if (me.isHolding) {
                            me.drawHold(me.holdingTarget);
                            me.holding();
                            me.throwBlockDefault();
                        } else if (me.inputField && me.fieldCDcycle < me.cycle) { //not hold but field button is pressed
                            if (me.tech.isPlasmaBoost && powerUps.boost.endCycle < simulation.cycle + 60) powerUps.boost.endCycle = simulation.cycle + 60

                            if (me.energy > me.fieldRegen) me.energy -= me.fieldRegen
                            me.grabPowerUp();
                            me.lookForBlock();
                            me.extruder();
                        } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) { //holding, but field button is released
                            me.pickUp();
                        } else {
                            me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                        }
                        if (me.inputField) {
                            me.wasExtruderOn = true
                        } else {
                            me.wasExtruderOn = false
                            me.canExtruderFire = true
                        }
                        ctx.beginPath(); //draw all the wave bullets
                        for (let i = 1, len = bullet.length; i < len; i++) { //skip the first bullet (which is is oldest bullet)
                            if (bullet[i].isWave) {
                                if (bullet[i].isBranch || bullet[i - 1].isBranch) {
                                    ctx.moveTo(bullet[i].position.x, bullet[i].position.y)
                                } else {
                                    ctx.lineTo(bullet[i].position.x, bullet[i].position.y)
                                }
                            }
                        }
                        if (me.wasExtruderOn && me.isExtruderOn) ctx.lineTo(me.pos.x + 15 * Math.cos(me.angle2), me.pos.y + 15 * Math.sin(me.angle2))
                        ctx.lineWidth = 4;
                        ctx.strokeStyle = "#f07"
                        ctx.stroke();
                        ctx.lineWidth = me.tech.extruderRange;
                        ctx.strokeStyle = "rgba(255,0,110,0.06)"
                        ctx.stroke();
                    } else {
                        if (me.isHolding) {
                            me.drawHold(me.holdingTarget);
                            me.holding();
                            me.throwBlockDefault();
                        } else if (me.inputField && me.fieldCDcycle < me.cycle) { //not hold but field button is pressed
                            if (me.tech.isPlasmaBoost && powerUps.boost.endCycle < simulation.cycle + 60) powerUps.boost.endCycle = simulation.cycle + 60

                            if (me.energy > me.fieldRegen) me.energy -= me.fieldRegen
                            me.grabPowerUp();
                            me.lookForBlock();
                            me.plasma();
                        } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) { //holding, but field button is released
                            me.pickUp();
                        } else {
                            me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                        }
                    }
                } else if (me.fieldMode == 6) {
                    if(me.isRewindMode) {
                        if (me.inputField) me.grabPowerUp();
                        if (me.isHolding) {
                            me.drawHold(me.holdingTarget);
                            me.holding();
                            me.throwBlock();
                            me.wakeCheck();
                        } else if (me.inputField && me.fieldCDcycle < me.cycle) { //not hold but field button is pressed
                            // const drain = 0.0015 / (1 + 0.05 * me.coupling)
                            // const DRAIN = 0.003
                            const drain = me.rewindDrain * 0.002
                            me.rewindDrain *= 1.0015
                            if (this.rewindCount === 0) me.lookForBlock();

                            if (!me.holdingTarget) {
                                if (me.energy > drain) {
                                    me.timeStop();
                                } else { //holding, but field button is released
                                    me.fieldCDcycle = me.cycle + 120;
                                    me.energy = 0;
                                    me.wakeCheck();
                                    me.wakeCheck();
                                }
                                this.isRewinding = true
                                this.rewindCount += 2;

                                let history = me.history[(simulation.cycle - this.rewindCount) % 600]
                                if (this.rewindCount > 599 || me.energy < drain) {
                                    this.rewindCount = 0;
                                    me.resetHistory();
                                    if (me.fireCDcycle < me.cycle + 60) me.fieldCDcycle = me.cycle + 60
                                    me.immuneCycle = me.cycle //if you reach the end of the history disable harm immunity
                                } else {
                                    //draw field everywhere
                                    ctx.globalCompositeOperation = "saturation"
                                    ctx.fillStyle = "#ccc";
                                    ctx.fillRect(-100000, -100000, 200000, 200000)
                                    ctx.globalCompositeOperation = "source-over"
                                    me.energy -= drain
                                    if (me.immuneCycle < me.cycle + 5) me.immuneCycle = me.cycle + 5; //me is immune to damage for 5 cycles
                                    Matter.Body.setPosition(me, history.position);
                                    Matter.Body.setVelocity(me, { x: history.velocity.x, y: history.velocity.y });

                                    me.yOff = history.yOff
                                    if (me.yOff < 48) {
                                        me.doCrouch()
                                    } else {
                                        me.undoCrouch()
                                    }

                                    ctx.beginPath();
                                    ctx.moveTo(me.pos.x, me.pos.y)
                                    const percentLeft = this.rewindCount / 600
                                    ctx.arc(me.pos.x, me.pos.y, 30, 3 * Math.PI / 2, 2 * Math.PI * (1 - percentLeft) + 3 * Math.PI / 2);
                                    ctx.lineTo(me.pos.x, me.pos.y)
                                    ctx.fillStyle = `rgba(0,150,150,${percentLeft})`;
                                    ctx.fill()
                                    me.grabPowerUpEasy();
                                }
                            }
                            // me.wakeCheck();
                        } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) { //holding, but field button is released
                            me.pickUp();
                            this.rewindCount = 0;
                            me.wakeCheck();
                        } else if (me.tech.isTimeStop && me.speed < 1 && me.onGround && !me.inputFire) {
                            me.timeStop();
                            this.rewindCount = 0;
                        } else {
                            me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                            this.rewindCount = 0;
                            me.wakeCheck();
                        }
                        if (!(me.inputField && me.fieldCDcycle < me.cycle)) {
                            if (me.rewindDrain > 1) me.rewindDrain /= 1.0005
                            if (this.isRewinding) {
                                this.isRewinding = false
                                me.resetHistory()
                            }
                        }
                    } else {
                        if (me.isHolding) {
                            me.wakeCheck();
                            me.drawHold(me.holdingTarget);
                            me.holding();
                            me.throwBlockDefault();
                        } else if (me.inputField && me.fieldCDcycle < me.cycle) {
                            const drain = 0.0026
                            if (me.energy > drain) me.energy -= drain
                            me.grabPowerUp();
                            me.lookForBlock(); //this drains energy 0.001
                            if (me.energy > drain) {
                                me.timeStop();
                            } else { //holding, but field button is released
                                me.fieldCDcycle = me.cycle + 120;
                                me.energy = 0;
                                me.wakeCheck();
                                me.wakeCheck();
                            }
                        } else if (me.tech.isTimeStop && me.speed < 1 && me.onGround && me.fireCDcycle < me.cycle && !me.inputFire) {
                            me.timeStop();
                        } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) { //holding, but field button is released
                            me.wakeCheck();
                            me.pickUp();
                        } else {
                            me.wakeCheck();
                            me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                        }
                    }
                } else if (me.fieldMode == 7) {
                    me.isSneakAttack = true;
                    if (me.isHolding) {
                        me.drawHold(me.holdingTarget);
                        me.holding();
                        me.throwBlockDefault();
                    } else if (me.inputField && me.fieldCDcycle < me.cycle) { //not hold and field button is pressed
                        if (me.energy > me.fieldRegen) me.energy -= me.fieldRegen
                        me.grabPowerUp();
                        me.lookForBlock();
                    } else if (me.holdingTarget && me.fieldCDcycle < me.cycle) { //holding target exists, and field button is not pressed
                        me.pickUp();
                    } else {
                        me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                    }
                    if (me.energy < 0.05 && me.fireCDcycle < me.cycle && !me.inputFire) me.fireCDcycle = me.cycle
                    if (me.fireCDcycle + 10 < me.cycle && !me.inputFire) { //automatically cloak if not firing
                        if (!me.isCloak) {
                            me.isCloak = true
                            me.enterCloakCycle = me.cycle
                        }
                    } else if (me.isCloak) { //exit cloak
                        me.sneakAttackCycle = me.cycle
                        me.isCloak = false

                        if (me.tech.isIntangible) {
                            for (let i = 0; i < bullet.length; i++) {
                                if (bullet[i].botType && bullet[i].botType !== "orbit") bullet[i].collisionFilter.mask = cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet | cat.mobShield
                            }
                        }
                        if (me.tech.isCloakStun) { //stun nearby mobs after exiting cloak
                            const stunRange = me.fieldDrawRadius * 1.25
                            for (let i = 0, len = mob.length; i < len; ++i) {
                                if (Vector.magnitude(Vector.sub(mob[i].position, me.pos)) < stunRange && Matter.Query.ray(map, mob[i].position, me.pos).length === 0 && !mob[i].isBadTarget) {
                                    isMobsAround = true
                                    mobs.statusStun(mob[i], 120)
                                }
                            }
                        }
                    }

                    if (me.isCloak) {
                        me.fieldRange = me.fieldRange * 0.85;
                        me.fieldDrawRadius = me.fieldRange * 1.1 //* 0.88 //* Math.min(1, 0.3 + 0.5 * Math.min(1, energy * energy));
                        me.drawCloak();
                    } else if (me.fieldRange < 4000) {
                        me.fieldRange += 90
                        me.fieldDrawRadius = me.fieldRange //* Math.min(1, 0.3 + 0.5 * Math.min(1, energy * energy));
                        //me.drawCloak()
                    }
                    if (me.tech.isIntangible) {
                        if (me.isCloak) {
                            me.collisionFilter.mask = cat.map
                        } else {
                            me.collisionFilter.mask = cat.player | cat.map | cat.body | cat.bullet | cat.mob;
                        }
                    }
                    if (me.isSneakAttack && me.sneakAttackCycle + Math.min(100, 0.66 * (me.cycle - me.enterCloakCycle)) > me.cycle) { //show sneak attack status
                        const timeLeft = (me.sneakAttackCycle + Math.min(100, 0.66 * (me.cycle - me.enterCloakCycle)) - me.cycle) * 0.5
                        ctx.beginPath();
                        ctx.arc(me.pos.x, me.pos.y, 32, 0, 2 * Math.PI);
                        ctx.strokeStyle = "rgba(180,30,70,0.5)";//"rgba(0,0,0,0.7)";//"rgba(255,255,255,0.7)";//"rgba(255,0,100,0.7)";
                        ctx.lineWidth = Math.max(Math.min(10, timeLeft), 3);
                        ctx.stroke();
                    }
                } else if (me.fieldMode == 8) {
                    let isOn = (me.tech.isNoPilotCost ? !me.inputField : me.inputField)
                    if (me.tech.isPrinter) {
                        //spawn blocks if field and crouch
                        if (me.inputField && me.fieldCDcycle < me.cycle && me.inputDown && !me.isHolding) {
                            me.printBlock()
                        }
                        //if holding block grow it
                        if (me.isHolding) {
                            me.drawHold(me.holdingTarget);
                            me.holding();
                            if (me.tech.isPrinter && me.holdingTarget.isPrinted && me.inputField) {
                                // if (Math.random() < 0.004 && me.holdingTarget.vertices.length < 12) me.holdingTarget.vertices.push({ x: 0, y: 0 }) //small chance to increase the number of vertices
                                me.holdingTarget.radius += Math.min(1.1, 1.3 / me.holdingTarget.mass) //grow up to a limit
                                const r1 = me.holdingTarget.radius * (1 + 0.12 * Math.sin(me.cycle * 0.11))
                                const r2 = me.holdingTarget.radius * (1 + 0.12 * Math.cos(me.cycle * 0.11))
                                let angle = (me.cycle * 0.01) % (2 * Math.PI) //rotate the object 
                                let vertices = []
                                for (let i = 0, len = me.holdingTarget.vertices.length; i < len; i++) {
                                    angle += 2 * Math.PI / len
                                    vertices.push({ x: me.holdingTarget.position.x + r1 * Math.cos(angle), y: me.holdingTarget.position.y + r2 * Math.sin(angle) })
                                }
                                Matter.Body.setVertices(me.holdingTarget, vertices)
                                me.definePlayerMass(me.defaultMass + me.holdingTarget.mass * me.holdingMassScale)
                            }
                            me.throwBlock()
                        } else {
                            me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                        }
                        //if releasing field throw it

                    }
                    if (isOn) {
                        if (me.fieldCDcycle < me.cycle) {
                            if (!me.fieldOn) { // if field was off, teleport to player
                                me.fieldOn = true;
                                Matter.Body.setPosition(me.pilotWaveCollider, me.pos);
                                me.fieldPosition.x = me.pos.x
                                me.fieldPosition.y = me.pos.y
                            }
                            const graphicScale = 1.2 //the draw range is a bit bigger then the interaction range
                            //when field is on it smoothly moves towards the mouse
                            const sub = Vector.sub(me.mouse, me.pilotWaveCollider.position)
                            const mag = Vector.magnitude(sub)

                            //adjust speed of field here, and with friction and mass above where the collier is spawned
                            const fieldMassScale = Math.max(1.5, Math.pow(me.fieldMass, 0.3)) //how much mass inside the field slows the push and cap
                            const scaledMag = 0.00000017 / fieldMassScale * Math.pow(mag, 2) //having the mag squared makes the effect weaker in close for fine movement
                            let push = Vector.mult(Vector.normalise(sub), scaledMag)
                            const cap = 0.17 / fieldMassScale //acts like a "speed limit"
                            if (Vector.magnitude(push) > cap) push = Vector.mult(Vector.normalise(push), cap)
                            me.pilotWaveCollider.force = push

                            //check for map collisions
                            if (Matter.Query.ray(map, me.fieldPosition, me.pilotWaveCollider.position).length) {
                                Matter.Body.setVelocity(me.pilotWaveCollider, Vector.mult(me.pilotWaveCollider.velocity, 0.6))
                                me.fieldRadius *= 0.6
                            }
                            me.fieldPosition.x = me.pilotWaveCollider.position.x
                            me.fieldPosition.y = me.pilotWaveCollider.position.y

                            //grab power ups into the field
                            for (let i = 0, len = powerUp.length; i < len; ++i) {
                                if (me.tech.isEnergyNoAmmo && powerUp[i].name === "ammo") continue

                                const dxP = me.fieldPosition.x - powerUp[i].position.x;
                                const dyP = me.fieldPosition.y - powerUp[i].position.y;
                                const dist2 = dxP * dxP + dyP * dyP + 200;
                                const graphicRange = graphicScale * me.fieldRadius
                                if (
                                    dist2 < graphicRange * graphicRange &&
                                    !simulation.isChoosing &&
                                    (me.tech.isOverHeal || powerUp[i].name !== "heal" || me.maxHealth - me.health > 0.01)
                                    // (powerUp[i].name !== "heal" || me.health < 0.94 * me.maxHealth)
                                    // (powerUp[i].name !== "ammo" || b.guns[b.activeGun].ammo !== Infinity)
                                ) { //use power up if it is close enough
                                    simulation.ephemera.push({
                                        count: 5, //cycles before it self removes
                                        PposX: powerUp[i].position.x,
                                        PposY: powerUp[i].position.y,
                                        size: powerUp[i].size,
                                        color: powerUp[i].color,
                                        do() {
                                            this.count--
                                            if (this.count < 0) simulation.removeEphemera(this)
                                            ctx.beginPath();
                                            ctx.arc(this.PposX, this.PposY, this.size * (this.count + 2) / 7, 0, 2 * Math.PI);
                                            ctx.fillStyle = this.color
                                            ctx.fill();
                                        },
                                    })

                                    powerUps.onPickUp(powerUp[i]);
                                    Matter.Composite.remove(engine.world, powerUp[i]);
                                    powerUp.splice(i, 1);
                                    // me.fieldRadius += 50
                                    break; //because the array order is messed up after splice
                                }
                            }

                            let radiusGoal, radiusSmooth, drainPassive
                            if (Matter.Query.ray(map, me.fieldPosition, player.position).length) { //is there something blocking the player's view of the field
                                radiusGoal = 0
                                radiusSmooth = 0.995
                                drainPassive = 1.5 * me.fieldRegen * me.drain
                            } else {
                                radiusGoal = Math.max(50, 250 - 2 * me.pilotWaveCollider.speed)
                                radiusSmooth = 0.97
                                drainPassive = me.fieldRegen * me.drain
                            }
                            if (me.tech.isNoPilotCost) drainPassive = 0
                            me.fieldRadius = me.fieldRadius * radiusSmooth + radiusGoal * (1 - radiusSmooth)

                            //track velocity change for calculating block energy drain
                            const speedChange = Math.max(0, me.pilotWaveCollider.speed - me.pilotWaveCollider.lastSpeed)
                            me.pilotWaveCollider.lastSpeed = me.pilotWaveCollider.speed

                            if (me.energy >= drainPassive) {
                                me.energy -= drainPassive;
                                me.fieldMass = 1
                                for (let i = 0, len = body.length; i < len; ++i) {
                                    if (Vector.magnitude(Vector.sub(body[i].position, me.fieldPosition)) < me.fieldRadius && !body[i].isNotHoldable) {
                                        // const drainBlock = me.pilotWaveCollider.speed * body[i].mass * 0.0000013
                                        const drainBlock = me.drain * speedChange * body[i].mass * 0.000095
                                        if (me.energy > drainBlock) {
                                            me.energy -= drainBlock;
                                            Matter.Body.setVelocity(body[i], me.pilotWaveCollider.velocity); //give block mouse velocity
                                            Matter.Body.setAngularVelocity(body[i], body[i].angularVelocity * 0.8)
                                            me.fieldMass += body[i].mass
                                            //blocks drift towards center of pilot wave
                                            const sub = Vector.sub(me.fieldPosition, body[i].position)
                                            const push = Vector.mult(Vector.normalise(sub), 0.0001 * body[i].mass * Vector.magnitude(sub))
                                            body[i].force.x += push.x
                                            body[i].force.y += push.y - body[i].mass * simulation.g //remove gravity effects

                                            if (me.standingOn === body[i] && me.onGround) {
                                                //try to stop the walk animation
                                                me.walk_cycle -= me.flipLegs * me.Vx
                                                me.stepSize = 0
                                                //extra stability
                                                Matter.Body.setAngularVelocity(body[i], body[i].angularVelocity * 0)
                                                //match velocity upto a change of 10 per cycle
                                                const limit = 10
                                                const deltaV = Math.max(-limit, Math.min((me.pilotWaveCollider.velocity.x - player.velocity.x), limit))
                                                Matter.Body.setVelocity(me, { x: player.velocity.x + deltaV, y: player.velocity.y });
                                            }
                                            if(typeof body[i].id == "string") sendBlockUpdate(body[i], true);
                                        } else {
                                            me.fieldCDcycle = me.cycle + 60;
                                            me.fieldOn = false
                                            me.fieldRadius = 0
                                            break
                                        }
                                    }
                                }
                                for (let i = 0, len = bullet.length; i < len; ++i) {
                                    // console.log(bullet[i].speed)
                                    if (!bullet[i].botType && bullet[i].speed < 30 && Vector.magnitude(Vector.sub(bullet[i].position, me.fieldPosition)) < me.fieldRadius && !bullet[i].isNotHoldable) {
                                        const drainBlock = me.drain * speedChange * bullet[i].mass * 0.000095
                                        if (me.energy > drainBlock) {
                                            Matter.Body.setVelocity(bullet[i], me.pilotWaveCollider.velocity); //give block mouse velocity
                                            Matter.Body.setAngularVelocity(bullet[i], bullet[i].angularVelocity * 0.99)
                                            // me.fieldMass += bullet[i].mass
                                            //blocks drift towards center of pilot wave
                                            const sub = Vector.sub(me.fieldPosition, bullet[i].position)
                                            const push = Vector.mult(Vector.normalise(sub), 0.0001 * bullet[i].mass * Vector.magnitude(sub))
                                            bullet[i].force.x += push.x
                                            bullet[i].force.y += push.y - bullet[i].mass * simulation.g //remove gravity effects
                                        }
                                    }
                                }

                                // if (me.tech.isFreezeMobs) {
                                //     for (let i = 0, len = mob.length; i < len; ++i) {
                                //         if (!mob[i].isMobBullet && !mob[i].shield && !mob[i].isShielded && Vector.magnitude(Vector.sub(mob[i].position, me.fieldPosition)) < me.fieldRadius + mob[i].radius) {
                                //             const ICE_DRAIN = 0.0005
                                //             if (me.energy > ICE_DRAIN) me.energy -= ICE_DRAIN;
                                //             mobs.statusSlow(mob[i], 180)
                                //         }
                                //     }
                                // }

                                ctx.beginPath();
                                const rotate = me.cycle * 0.008;
                                me.fieldPhase += 0.2 // - 0.5 * Math.sqrt(Math.min(me.energy, 1));
                                const off1 = 1 + 0.06 * Math.sin(me.fieldPhase);
                                const off2 = 1 - 0.06 * Math.sin(me.fieldPhase);
                                ctx.beginPath();
                                ctx.ellipse(me.fieldPosition.x, me.fieldPosition.y, graphicScale * me.fieldRadius * off1, graphicScale * me.fieldRadius * off2, rotate, 0, 2 * Math.PI);
                                ctx.globalCompositeOperation = "exclusion";
                                ctx.fillStyle = "#fff";
                                ctx.fill();
                                ctx.globalCompositeOperation = "source-over";
                                ctx.beginPath();
                                ctx.ellipse(me.fieldPosition.x, me.fieldPosition.y, graphicScale * me.fieldRadius * off1, graphicScale * me.fieldRadius * off2, rotate, 0, 2 * Math.PI * me.energy / me.maxEnergy);
                                if (radiusGoal || me.cycle % 5) {
                                    ctx.strokeStyle = "#000";
                                } else {
                                    ctx.strokeStyle = "#fff";
                                }
                                ctx.lineWidth = 4;
                                ctx.stroke();

                            } else {
                                me.fieldCDcycle = me.cycle + 60;
                                me.fieldOn = false
                                me.fieldRadius = 0
                            }
                        } else {
                            me.grabPowerUp();
                        }
                    } else {
                        me.fieldOn = false
                        me.fieldRadius = 0
                    }
                    if (me.inputField) me.grabPowerUp();
                } else if (me.fieldMode == 9) {
                    if (me.hole.isOn) {
                        // draw holes
                        me.fieldRange = 0.97 * me.fieldRange + 0.03 * (50 + 10 * Math.sin(simulation.cycle * 0.025))
                        const semiMajorAxis = me.fieldRange + 30
                        const edge1a = Vector.add(Vector.mult(me.hole.unit, semiMajorAxis), me.hole.pos1)
                        const edge1b = Vector.add(Vector.mult(me.hole.unit, -semiMajorAxis), me.hole.pos1)
                        const edge2a = Vector.add(Vector.mult(me.hole.unit, semiMajorAxis), me.hole.pos2)
                        const edge2b = Vector.add(Vector.mult(me.hole.unit, -semiMajorAxis), me.hole.pos2)
                        ctx.beginPath();
                        ctx.moveTo(edge1a.x, edge1a.y)
                        ctx.bezierCurveTo(me.hole.pos1.x, me.hole.pos1.y, me.hole.pos2.x, me.hole.pos2.y, edge2a.x, edge2a.y);
                        ctx.lineTo(edge2b.x, edge2b.y)
                        ctx.bezierCurveTo(me.hole.pos2.x, me.hole.pos2.y, me.hole.pos1.x, me.hole.pos1.y, edge1b.x, edge1b.y);
                        ctx.fillStyle = `rgba(255,255,255,${200 / me.fieldRange / me.fieldRange})` //"rgba(0,0,0,0.1)"
                        ctx.fill();
                        ctx.beginPath();
                        ctx.ellipse(me.hole.pos1.x, me.hole.pos1.y, me.fieldRange, semiMajorAxis, me.hole.angle, 0, 2 * Math.PI)
                        ctx.ellipse(me.hole.pos2.x, me.hole.pos2.y, me.fieldRange, semiMajorAxis, me.hole.angle, 0, 2 * Math.PI)
                        ctx.fillStyle = `rgba(255,255,255,${32 / me.fieldRange})`
                        ctx.fill();

                        //suck power ups
                        for (let i = 0, len = powerUp.length; i < len; ++i) {
                            if (me.tech.isEnergyNoAmmo && powerUp[i].name === "ammo") continue
                            //which hole is closer
                            const dxP1 = me.hole.pos1.x - powerUp[i].position.x;
                            const dyP1 = me.hole.pos1.y - powerUp[i].position.y;
                            const dxP2 = me.hole.pos2.x - powerUp[i].position.x;
                            const dyP2 = me.hole.pos2.y - powerUp[i].position.y;
                            let dxP, dyP, dist2
                            if (dxP1 * dxP1 + dyP1 * dyP1 < dxP2 * dxP2 + dyP2 * dyP2) {
                                dxP = dxP1
                                dyP = dyP1
                            } else {
                                dxP = dxP2
                                dyP = dyP2
                            }
                            dist2 = dxP * dxP + dyP * dyP;
                            if (dist2 < 600000) { //&& !(me.health === me.maxHealth && powerUp[i].name === "heal")
                                powerUp[i].force.x += 4 * (dxP / dist2) * powerUp[i].mass; // float towards hole
                                powerUp[i].force.y += 4 * (dyP / dist2) * powerUp[i].mass - powerUp[i].mass * simulation.g; //negate gravity
                                Matter.Body.setVelocity(powerUp[i], { x: powerUp[i].velocity.x * 0.05, y: powerUp[i].velocity.y * 0.05 });
                                if (dist2 < 1000 && !simulation.isChoosing) { //use power up if it is close enough

                                    simulation.ephemera.push({
                                        count: 5, //cycles before it self removes
                                        PposX: powerUp[i].position.x,
                                        PposY: powerUp[i].position.y,
                                        size: powerUp[i].size,
                                        color: powerUp[i].color,
                                        do() {
                                            this.count--
                                            if (this.count < 0) simulation.removeEphemera(this)
                                            ctx.beginPath();
                                            ctx.arc(this.PposX, this.PposY, Math.max(1, this.size * (this.count + 1) / 7), 0, 2 * Math.PI);
                                            ctx.fillStyle = this.color
                                            ctx.fill();
                                        },
                                    })

                                    me.fieldRange *= 0.8
                                    powerUps.onPickUp(powerUp[i]);
                                    Matter.Composite.remove(engine.world, powerUp[i]);
                                    powerUp.splice(i, 1);
                                    break; //because the array order is messed up after splice
                                }
                            }
                        }
                        //suck and shrink blocks
                        const suckRange = 500
                        const shrinkRange = 100
                        const shrinkScale = 0.97;
                        const slowScale = 0.9
                        for (let i = 0, len = body.length; i < len; i++) {
                            if (!body[i].isNotHoldable) {
                                const dist1 = Vector.magnitude(Vector.sub(me.hole.pos1, body[i].position))
                                const dist2 = Vector.magnitude(Vector.sub(me.hole.pos2, body[i].position))
                                if (dist1 < dist2) {
                                    if (dist1 < suckRange) {
                                        const pull = Vector.mult(Vector.normalise(Vector.sub(me.hole.pos1, body[i].position)), 1)
                                        const slow = Vector.mult(body[i].velocity, slowScale)
                                        Matter.Body.setVelocity(body[i], Vector.add(slow, pull));
                                        //shrink
                                        if (Vector.magnitude(Vector.sub(me.hole.pos1, body[i].position)) < shrinkRange) {
                                            Matter.Body.scale(body[i], shrinkScale, shrinkScale);
                                            if (body[i].mass < 0.05) {
                                                Matter.Composite.remove(engine.world, body[i]);
                                                body.splice(i, 1);
                                                me.fieldRange *= 0.8
                                                if ((me.fieldMode === 0 || me.fieldMode === 9) && me.immuneCycle < me.cycle) me.energy += 0.02 * me.coupling * level.isReducedRegen
                                                if (me.tech.isWormholeWorms) { //pandimensional spermia
                                                    for (let i = 0, len = 1 + Math.floor(4 * Math.random()); i < len; i++) {
                                                        b2.worm(Vector.add(me.hole.pos2, Vector.rotate({ x: me.fieldRange * 0.4, y: 0 }, 2 * Math.PI * Math.random())), me.id)
                                                        Matter.Body.setVelocity(bullet[bullet.length - 1], Vector.mult(Vector.rotate(me.hole.unit, Math.PI / 2), -10));
                                                    }
                                                }
                                                break
                                            }
                                        }
                                    }
                                } else if (dist2 < suckRange) {
                                    const pull = Vector.mult(Vector.normalise(Vector.sub(me.hole.pos2, body[i].position)), 1)
                                    const slow = Vector.mult(body[i].velocity, slowScale)
                                    Matter.Body.setVelocity(body[i], Vector.add(slow, pull));
                                    //shrink
                                    if (Vector.magnitude(Vector.sub(me.hole.pos2, body[i].position)) < shrinkRange) {
                                        Matter.Body.scale(body[i], shrinkScale, shrinkScale);
                                        if (body[i].mass < 0.05) {
                                            Matter.Composite.remove(engine.world, body[i]);
                                            body.splice(i, 1);
                                            me.fieldRange *= 0.8
                                            if ((me.fieldMode === 0 || me.fieldMode === 9) && me.immuneCycle < me.cycle) me.energy += 0.02 * me.coupling * level.isReducedRegen
                                            if (me.fieldMode === 0 || me.fieldMode === 9) me.energy += 0.02 * me.coupling * level.isReducedRegen
                                            if (me.tech.isWormholeWorms) { //pandimensional spermia
                                                for (let i = 0, len = 1 + Math.floor(4 * Math.random()); i < len; i++) {
                                                    b2.worm(Vector.add(me.hole.pos2, Vector.rotate({ x: me.fieldRange * 0.4, y: 0 }, 2 * Math.PI * Math.random())), me.id)
                                                    Matter.Body.setVelocity(bullet[bullet.length - 1], Vector.mult(Vector.rotate(me.hole.unit, Math.PI / 2), -10));
                                                }
                                            }
                                            break
                                        }
                                    }
                                }
                            }
                        }
                        if (me.tech.isWormHoleBullets) {
                            //teleport bullets
                            for (let i = 0, len = bullet.length; i < len; ++i) { //teleport bullets from hole1 to hole2
                                if (!bullet[i].botType && !bullet[i].isInHole) { //don't teleport bots
                                    if (Vector.magnitude(Vector.sub(me.hole.pos1, bullet[i].position)) < me.fieldRange) { //find if bullet is touching hole1
                                        Matter.Body.setPosition(bullet[i], Vector.add(me.hole.pos2, Vector.sub(me.hole.pos1, bullet[i].position)));
                                        me.fieldRange += 5
                                        bullet[i].isInHole = true
                                    } else if (Vector.magnitude(Vector.sub(me.hole.pos2, bullet[i].position)) < me.fieldRange) { //find if bullet is touching hole1
                                        Matter.Body.setPosition(bullet[i], Vector.add(me.hole.pos1, Vector.sub(me.hole.pos2, bullet[i].position)));
                                        me.fieldRange += 5
                                        bullet[i].isInHole = true
                                    }
                                }
                            }
                            // mobs get pushed away
                            for (let i = 0, len = mob.length; i < len; i++) {
                                if(mob[i].id != me.id) {
                                    if (Vector.magnitude(Vector.sub(me.hole.pos1, mob[i].position)) < 200) {
                                        const pull = Vector.mult(Vector.normalise(Vector.sub(me.hole.pos1, mob[i].position)), -0.07)
                                        Matter.Body.setVelocity(mob[i], Vector.add(mob[i].velocity, pull));
                                    }
                                    if (Vector.magnitude(Vector.sub(me.hole.pos2, mob[i].position)) < 200) {
                                        const pull = Vector.mult(Vector.normalise(Vector.sub(me.hole.pos2, mob[i].position)), -0.07)
                                        Matter.Body.setVelocity(mob[i], Vector.add(mob[i].velocity, pull));
                                    }
                                }
                            }
                        }
                    }

                    if (me.fieldCDcycle < me.cycle) {
                        const scale = 40
                        const justPastMouse = Vector.add(Vector.mult(Vector.normalise(Vector.sub(me.mouse, me.pos)), 25), me.mouse) //used to see if the wormhole will collide with wall
                        const sub = Vector.sub(me.mouse, me.pos)
                        // const mag = Vector.magnitude(sub)

                        if (me.inputField) {
                            if (me.tech.isWormHolePause) {
                                // const drain = me.fieldRegen + 0.000035
                                // if (me.energy > drain) {
                                // me.energy -= drain
                                if (me.immuneCycle < me.cycle + 1) me.immuneCycle = me.cycle + 1; //me is immune to damage for 1 cycle
                                me.isTimeDilated = true;

                                function sleep(who) {
                                    for (let i = 0, len = who.length; i < len; ++i) {
                                        if (!who[i].isSleeping) {
                                            who[i].storeVelocity = who[i].velocity
                                            who[i].storeAngularVelocity = who[i].angularVelocity
                                        }
                                        Matter.Sleeping.set(who[i], true)
                                    }
                                }
                                sleep(mob);
                                sleep(body);
                                sleep(bullet);
                                simulation.cycle--; //pause all functions that depend on game cycle increasing
                                Matter.Body.setVelocity(me, { //keep me frozen
                                    x: 0,
                                    y: -55 * me.mass * simulation.g //undo gravity before it is added
                                });
                                me.force.x = 0
                                me.force.y = 0
                            }
                            me.grabPowerUp();
                            this.drain = me.tech.isFreeWormHole ? 0.02 : 0.16
                            const unit = Vector.perp(Vector.normalise(sub))
                            const where = { x: me.pos.x + 30 * Math.cos(me.angle2), y: me.pos.y + 30 * Math.sin(me.angle2) }
                            me.fieldRange = 0.97 * me.fieldRange + 0.03 * (50 + 10 * Math.sin(simulation.cycle * 0.025))
                            const edge2a = Vector.add(Vector.mult(unit, 1.5 * me.fieldRange), me.mouse)
                            const edge2b = Vector.add(Vector.mult(unit, -1.5 * me.fieldRange), me.mouse)
                            //draw possible wormhole
                            ctx.beginPath();
                            ctx.moveTo(where.x, where.y)
                            ctx.bezierCurveTo(where.x, where.y, me.mouse.x, me.mouse.y, edge2a.x, edge2a.y);
                            ctx.moveTo(where.x, where.y)
                            ctx.bezierCurveTo(where.x, where.y, me.mouse.x, me.mouse.y, edge2b.x, edge2b.y);
                            if (
                                me.energy > this.drain &&
                                (me.tech.isWormholeMapIgnore || Matter.Query.ray(map, me.pos, justPastMouse).length === 0) &&
                                Matter.Query.region(map, {
                                    min: { x: me.mouse.x - scale, y: me.mouse.y - scale },
                                    max: { x: me.mouse.x + scale, y: me.mouse.y + scale }
                                }).length === 0
                            ) {
                                me.hole.isReady = true;
                                // ctx.fillStyle = "rgba(255,255,255,0.5)"
                                // ctx.fill();
                                ctx.lineWidth = 1
                                ctx.strokeStyle = "#000"
                                ctx.stroke();
                            } else {
                                me.hole.isReady = false;
                                ctx.lineWidth = 1
                                ctx.strokeStyle = "#000"
                                ctx.lineDashOffset = 30 * Math.random()
                                ctx.setLineDash([20, 40]);
                                ctx.stroke();
                                ctx.setLineDash([]);
                            }
                        } else {
                            if (
                                me.hole.isReady && me.energy > this.drain &&
                                (me.tech.isWormholeMapIgnore || Matter.Query.ray(map, me.pos, justPastMouse).length === 0) &&
                                Matter.Query.region(map, {
                                    min: { x: me.mouse.x - scale, y: me.mouse.y - scale },
                                    max: { x: me.mouse.x + scale, y: me.mouse.y + scale }
                                }).length === 0
                            ) {
                                me.energy -= this.drain
                                me.hole.isReady = false;
                                me.fieldRange = 0
                                Matter.Body.setPosition(me, me.mouse);
                                me.buttonCD_jump = 0 //this might fix a bug with jumping

                                const velocity = Vector.mult(Vector.normalise(sub), 15)
                                Matter.Body.setVelocity(me, { x: velocity.x, y: velocity.y - 5 }); //an extra vertical kick so the me hangs in place longer

                                if (me.immuneCycle < me.cycle + 5) me.immuneCycle = me.cycle + 5; //me is immune to damage for 1/4 seconds 
                                me.hole.isOn = true;
                                // me.hole.pos1.x = me.pos.x
                                // me.hole.pos1.y = me.pos.y
                                // me.hole.pos2.x = me.position.x
                                // me.hole.pos2.y = me.position.y
                                me.hole.angle = Math.atan2(sub.y, sub.x)
                                me.hole.unit = Vector.perp(Vector.normalise(sub))

                                if (me.tech.isWormholeDamage) {
                                    who = Matter.Query.ray(mob, me.pos, me.mouse, 100)
                                    for (let i = 0; i < who.length; i++) {
                                        if (who[i].body.alive && who[i].id != me.id) {
                                            mobs.statusDoT(who[i].body, 1, 420)
                                            mobs.statusStun(who[i].body, 360)
                                        }
                                    }
                                }
                                if (me.tech.isNewWormHoleDamage) {
                                    const dmg = 1.5
                                    me.damageDone *= dmg
                                    simulation.ephemera.push({
                                        count: 300, //cycles before it self removes
                                        do() {
                                            this.count--
                                            if (this.count < 0) {
                                                simulation.removeEphemera(this)
                                                me.damageDone /= dmg
                                            }
                                        },
                                    })
                                }
                            }
                        }
                    }
                } else if (me.fieldMode == 10) {
                    if (me.isHolding) {
                        me.drawHold(me.holdingTarget);
                        me.holding();
                        me.throwBlock();
                    } else if (me.inputField) {
                        me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                        if (me.fieldCDcycle < me.cycle) {
                            if (me.fieldCDcycle < me.cycle + 15) me.fieldCDcycle = me.cycle + 15
                            if (me.energy > 0.02) me.energy -= 0.02
                            b2.grapple({ x: me.pos.x + 40 * Math.cos(me.angle2), y: me.pos.y + 40 * Math.sin(me.angle2) }, me.angle2, me.id)
                            if (me.fieldCDcycle < me.cycle + 20) me.fieldCDcycle = me.cycle + 20
                        }
                        me.grabPowerUp();
                    } else {
                        me.holdingTarget = null; //clears holding target (this is so you only pick up right after the field button is released and a hold target exists)
                        if (me.tech.isHookDefense && me.energy > 0.15 && me.fieldCDcycle < me.cycle) {
                            const range = 300
                            for (let i = 0; i < mob.length; i++) {
                                if (!mob[i].isBadTarget &&
                                    mob[i].id != me.id &&
                                    !mob[i].isInvulnerable &&
                                    Vector.magnitude(Vector.sub(me.pos, mob[i].position)) < range &&
                                    Matter.Query.ray(map, me.pos, mob[i].position).length === 0
                                ) {
                                    me.energy -= 0.1
                                    if (me.fieldCDcycle < me.cycle + 20) me.fieldCDcycle = me.cycle + 20
                                    const angle = Math.atan2(mob[i].position.y - me.position.y, mob[i].position.x - me.position.x);
                                    b2.harpoon(me.pos, mob[i], angle, 0.75, true, 20, false, undefined, me.id) // harpoon(where, target, angle = me.angle, harpoonSize = 1, isReturn = false, totalCycles = 35, isReturnAmmo = true, thrust = 0.1) {
                                    bullet[bullet.length - 1].drain = 0
                                    const maxCount = 6
                                    for (let j = maxCount - 1; j > 0; j--) {
                                        b2.harpoon(me.pos, mob[i], angle + j * 2 * Math.PI / maxCount, 0.75, true, 10, false, undefined, me.id)
                                        bullet[bullet.length - 1].drain = 0
                                    }
                                    break
                                }
                            }
                            ctx.beginPath();
                            ctx.arc(me.pos.x, me.pos.y, range, 0, 2 * Math.PI);
                            ctx.strokeStyle = "#000";
                            ctx.lineWidth = 0.25;
                            ctx.setLineDash([10, 30]);
                            ctx.stroke();
                            ctx.setLineDash([]);
                        }
                    }
                }
                if(me.fieldMode != me.oldField) {
                    me.oldField = me.fieldMode;
                    me.setHoldDefaults();
                    if(me.fieldMode == 5) {
                        me.isExtruderOn = false;
                        if (me.plasmaBall) {
                            me.plasmaBall.reset()
                            Matter.Composite.remove(engine.world, me.plasmaBall);
                        }
                        me.plasmaBall = Bodies.circle(me.pos.x + 10 * Math.cos(me.angle2), me.pos.y + 10 * Math.sin(me.angle2), 1, {
                            isSensor: true,
                            frictionAir: 0,
                            alpha: 0.7,
                            isAttached: false,
                            isOn: false,
                            drain: 0.0018,
                            radiusLimit: 10,
                            damage: 0.7,
                            effectRadius: 10,
                            setPositionToNose() {
                                const r = 27
                                const nose = { x: me.pos.x + r * Math.cos(me.angle2), y: me.pos.y + r * Math.sin(me.angle2) }
                                me.plasmaBall.effectRadius = 2 * me.plasmaBall.circleRadius
                                Matter.Body.setPosition(this, Vector.add(nose, Vector.mult(Vector.normalise(Vector.sub(nose, me.pos)), this.effectRadius)));
                            },
                            fire() {
                                const drain = 0.06
                                if (me.energy > drain) me.energy -= drain
                                this.isAttached = false;
                                const speed = 5 + Math.min(15, 80 / this.mass) //scale speed with mass
                                Matter.Body.setVelocity(this, {
                                    x: me.velocity.x * 0.4 + speed * Math.cos(me.angle2),
                                    y: speed * Math.sin(me.angle2)
                                });
                                me.plasmaBall.setPositionToNose()
                            },
                            scale(scale) {
                                if (this.circleRadius > this.radiusLimit) Matter.Body.scale(me.plasmaBall, scale, scale); //shrink fast
                            },
                            reset() {
                                const scale = 1 / this.circleRadius
                                Matter.Body.scale(this, scale, scale); //grow
                                this.alpha = 0.7
                                this.isOn = false
                                // this.isAttached = true;
                            },
                            do() {
                                if (this.isOn) {
                                    this.effectRadius = 2 * me.plasmaBall.circleRadius * (0.6 + 0.4 * me.tech.isPlasmaRange)

                                    if (Matter.Query.collides(this, map).length > 0) {
                                        if (this.isAttached) {
                                            this.scale(Math.max(0.9, 0.99 - 0.1 / this.circleRadius))
                                        } else {
                                            me.plasmaBall.explode()
                                            Matter.Body.setVelocity(this, { x: 0, y: 0 });
                                            this.reset()
                                        }
                                    }

                                    //damage nearby mobs
                                    const dmg = this.damage * ((me.tech.isControlPlasma && !this.isAttached) ? 2 : 1)
                                    const arcList = []
                                    const dischargeRange = 150 + 1600 * me.tech.plasmaDischarge + 1.3 * this.effectRadius
                                    for (let i = 0, len = mob.length; i < len; i++) {
                                        if (mob[i].alive && (!mob[i].isBadTarget || mob[i].isMobBullet || mob[i].id != me.id) && !mob[i].isInvulnerable) {
                                            const sub = Vector.magnitude(Vector.sub(this.position, mob[i].position))
                                            if (sub < this.effectRadius + mob[i].radius) {
                                                mob[i].damage(dmg);
                                                if (mob[i].speed > 5) {
                                                    Matter.Body.setVelocity(mob[i], { x: mob[i].velocity.x * 0.6, y: mob[i].velocity.y * 0.6 });
                                                } else {
                                                    Matter.Body.setVelocity(mob[i], { x: mob[i].velocity.x * 0.93, y: mob[i].velocity.y * 0.93 });
                                                }
                                            } else if (sub < dischargeRange + mob[i].radius && Matter.Query.ray(map, mob[i].position, this.position).length === 0) {
                                                arcList.push(mob[i]) //populate electrical arc list
                                            }
                                        }
                                    }
                                    const sub2 = Vector.magnitude(Vector.sub(this.position, player.position))
                                    if (sub2 < this.effectRadius + m.radius) {
                                        if (player.speed > 5) {
                                            Matter.Body.setVelocity(player, { x: player.velocity.x * 0.6, y: player.velocity.y * 0.6 });
                                        } else {
                                            Matter.Body.setVelocity(player, { x: player.velocity.x * 0.93, y: player.velocity.y * 0.93 });
                                        }
                                    }
                                    for (let i = 0; i < arcList.length; i++) {
                                        if (me.tech.plasmaDischarge > Math.random()) {
                                            const who = arcList[Math.floor(Math.random() * arcList.length)]
                                            who.damage(dmg * 4);
                                            //draw arcs
                                            const sub = Vector.sub(who.position, this.position)
                                            const unit = Vector.normalise(sub)
                                            let len = 12
                                            const step = Vector.magnitude(sub) / (len + 2)
                                            let x = this.position.x
                                            let y = this.position.y
                                            ctx.beginPath();
                                            ctx.moveTo(x, y);
                                            for (let i = 0; i < len; i++) {
                                                x += step * (unit.x + (Math.random() - 0.5))
                                                y += step * (unit.y + (Math.random() - 0.5))
                                                ctx.lineTo(x, y);
                                            }
                                            ctx.lineTo(who.position.x, who.position.y);
                                            ctx.strokeStyle = "#88f";
                                            ctx.lineWidth = 6 + 3 * Math.random();
                                            ctx.stroke();
                                            if (who.damageReduction) {
                                                simulation.drawList.push({
                                                    x: who.position.x,
                                                    y: who.position.y,
                                                    radius: 15,
                                                    color: "rgba(150,150,255,0.4)",
                                                    time: 15
                                                });
                                            }
                                        }
                                    }

                                    //graphics
                                    const radius = this.effectRadius * (0.99 + 0.02 * Math.random()) + 3 * Math.random()
                                    const gradient = ctx.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, radius);
                                    const alpha = this.alpha + 0.15 * Math.random()
                                    const stop = 0.75 + 0.1 * Math.random()
                                    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
                                    gradient.addColorStop(stop, `rgba(255,245,255,${alpha})`);
                                    gradient.addColorStop(stop + 0.1, `rgba(255,200,255,${alpha})`);
                                    gradient.addColorStop(1, `rgba(255,75,255,${alpha})`);
                                    // gradient.addColorStop(1, `rgba(255,150,255,${alpha})`);
                                    ctx.fillStyle = gradient
                                    ctx.beginPath();
                                    ctx.arc(this.position.x, this.position.y, radius, 0, 2 * Math.PI);
                                    ctx.fill();
                                    if (me.tech.isControlPlasma) {
                                        if (!this.isAttached) {
                                            //extra stroke to show 2x damage
                                            ctx.strokeStyle = "rgb(255, 0, 212)";
                                            ctx.lineWidth = Math.max(2, 0.04 * this.effectRadius);
                                            ctx.stroke();
                                        }
                                        //mouse control
                                        const mouseUnit = Vector.normalise(Vector.sub(simulation.mouseInGame, this.position))
                                        const speed = Vector.magnitude(this.velocity) //save current speed
                                        const push = Vector.mult(mouseUnit, 0.008 * Math.pow(speed, 1.8)) //roughly optimized to produce similar turing radius for different sizes
                                        Matter.Body.setVelocity(this, Vector.add(push, this.velocity));
                                        Matter.Body.setVelocity(this, Vector.mult(Vector.normalise(this.velocity), speed)); //keep speed constant
                                    }

                                    //draw arc from radius inward in a random walk
                                    ctx.beginPath();
                                    const unit = Vector.rotate({ x: 1, y: 0 }, Math.random() * 6.28)
                                    let where = Vector.add(this.position, Vector.mult(unit, 0.98 * radius))
                                    ctx.moveTo(where.x, where.y)
                                    const sub = Vector.normalise(Vector.sub(this.position, where))
                                    for (let i = 0, len = 7; i < len; i++) {
                                        const step = Vector.rotate(Vector.mult(sub, 17 * Math.random()), 2 * (Math.random() - 0.5))
                                        where = Vector.add(where, step)
                                        ctx.lineTo(where.x, where.y)
                                    }
                                    ctx.strokeStyle = "#88f";
                                    ctx.lineWidth = 0.5 + 2 * Math.random();
                                    ctx.stroke();
                                }
                            },
                            explode() {
                                simulation.ephemera.push({
                                    vertices: this.vertices,
                                    position: {
                                        x: me.plasmaBall.position.x,
                                        y: me.plasmaBall.position.y
                                    },
                                    radius: me.plasmaBall.effectRadius,
                                    alpha: 1,
                                    do() {
                                        // console.log(this.radius)
                                        //grow and fade
                                        this.radius *= 1.05
                                        this.alpha -= 0.05
                                        if (this.alpha < 0) simulation.removeEphemera(this)
                                        //graphics
                                        const radius = this.radius * (0.99 + 0.02 * Math.random()) + 3 * Math.random()
                                        const gradient = ctx.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, radius);
                                        const alpha = this.alpha + 0.15 * Math.random()
                                        const stop = 0.75 + 0.1 * Math.random()
                                        gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
                                        gradient.addColorStop(stop, `rgba(255,245,255,${alpha})`);
                                        gradient.addColorStop(stop + 0.1, `rgba(255,200,255,${alpha})`);
                                        gradient.addColorStop(1, `rgba(255,75,255,${alpha})`);
                                        // gradient.addColorStop(1, `rgba(255,150,255,${alpha})`);
                                        ctx.fillStyle = gradient
                                        ctx.beginPath();
                                        ctx.arc(this.position.x, this.position.y, radius, 0, 2 * Math.PI);
                                        ctx.fill();

                                        //damage nearby mobs
                                        const dmg = me.plasmaBall.damage
                                        for (let i = 0, len = mob.length; i < len; i++) {
                                            if (mob[i].alive && (!mob[i].isBadTarget || mob[i].isMobBullet) && !mob[i].isInvulnerable) {
                                                const sub = Vector.magnitude(Vector.sub(this.position, mob[i].position))
                                                if (sub < this.radius + mob[i].radius) {
                                                    mob[i].damage(dmg);
                                                }
                                            }
                                        }

                                    },
                                })
                            }
                        });
                        Composite.add(engine.world, me.plasmaBall);
                    }
                    if(me.fieldMode == 6) {
                        me.fieldFx = 1.25;
                        me.rewindDrain = 1;
                        me.grabPowerUpRange2 = 200000
                    }
                    if(me.fieldMode == 8) {
                        me.drop();
                        me.pilotWaveCollider = Matter.Bodies.polygon(me.pos.x, me.pos.y, 8, 35, {
                            friction: 0,
                            frictionAir: 0.12,
                            collisionFilter: { category: cat.player, mask: cat.map }, //no collision because player is holding
                            classType: "field",
                            lastSpeed: 0,
                        });
                        Composite.add(engine.world, me.pilotWaveCollider);
                    } else if (me.pilotWaveCollider) {
                        Matter.Composite.remove(engine.world, me.pilotWaveCollider);
                        me.pilotWaveCollider = null
                    }
                    if(me.fieldMode == 9) {
                        me.fieldRange = 0;
                    }
                    if(me.fieldMode == 10) {
                        me.grabPowerUpRange2 = 300000;
                    }
                }
                if (me.inputFire && (!me.inputField || me.fieldMode == 6 || me.fieldMode == 3 || me.fieldMode == 7 || me.fieldMode == 8 || me.fieldMode == 10) && me.cycle >= me.fireCDcycle) {
                    me.drop();
                    if (me.gunType == 0 && me.cycle >= me.nextFireCycle) {//nailgun
                        if (me.tech.nailRecoil) {
                            if (me.tech.isRivets) {
                                if (me.nextFireCycle + 1 < me.cycle) me.startingHoldCycle = me.cycle 
                                const CD = Math.max(25 - 0.14 * (me.cycle - me.startingHoldCycle), 5) 
                                me.nextFireCycle = me.cycle + CD * me.fireCDscale 
                                me.fireCDcycle = me.cycle + Math.floor(CD * me.fireCDscale); 

                                const em = bullet.length;
                                const size = me.tech.bulletSize * 8
                                bullet[em] = Bodies.rectangle(me.pos.x + 35 * Math.cos(me.angle2), me.pos.y + 35 * Math.sin(me.angle2), 5 * size, size, b2.fireAttributes(me.angle2, me.id));
                                bullet[em].dmg = me.tech.isNailRadiation ? 0 : 2.75
                                Matter.Body.setDensity(bullet[em], 0.002);
                                Composite.add(engine.world, bullet[em]); 
                                const SPEED = me.crouch ? 62 : 52
                                Matter.Body.setVelocity(bullet[em], {
                                    x: SPEED * Math.cos(me.angle2),
                                    y: SPEED * Math.sin(me.angle2)
                                });
                                bullet[em].endCycle = simulation.cycle + 180
                                bullet[em].beforeDmg = function (who) { 
                                    if (me.tech.isIncendiary) {
                                        this.endCycle = 0; 
                                        b.explosion(this.position, 100 + (Math.random() - 0.5) * 20); 
                                    }
                                    if (me.tech.isNailCrit) {
                                        if (!who.shield && Vector.dot(Vector.normalise(Vector.sub(who.position, this.position)), Vector.normalise(this.velocity)) > 0.97 - 1 / who.radius) {
                                            b.explosion(this.position, 300 + 40 * Math.random()); 
                                        }
                                    } else if (me.tech.isCritKill) b.crit(who, this)
                                    if (me.tech.isNailRadiation) mobs.statusDoT(who, 7 * (me.tech.isFastRadiation ? 0.7 : 0.24), me.tech.isSlowRadiation ? 360 : (me.tech.isFastRadiation ? 60 : 180)) 
                                    if (this.speed > 4 && me.tech.fragments) {
                                        b2.targetedNail(this.position, 1.25 * me.tech.fragments * me.tech.bulletSize, 40 + 10 * Math.random(), 1200, 1.4, me.id) //position, num = 1, speed = 40 + 10 * Math.random(), range = 1200, damage = 1.4
                                        this.endCycle = 0 
                                    }
                                };

                                bullet[em].minDmgSpeed = 10
                                bullet[em].frictionAir = 0.006;
                                bullet[em].rotateToVelocity = function () { 
                                    if (this.speed > 7) {
                                        const facing = {
                                            x: Math.cos(this.angle),
                                            y: Math.sin(this.angle)
                                        }
                                        const mag = 0.002 * this.mass
                                        if (Vector.cross(Vector.normalise(this.velocity), facing) < 0) {
                                            this.torque += mag
                                        } else {
                                            this.torque -= mag
                                        }
                                    }
                                };
                                if (me.tech.isIncendiary) {
                                    bullet[em].do = function () {
                                        this.force.y += this.mass * 0.0008
                                        this.rotateToVelocity()
                                        
                                        if (Matter.Query.collides(this, map).length) { 
                                            this.endCycle = 0; 
                                            b.explosion(this.position, 100 + (Math.random() - 0.5) * 20); 
                                        }
                                    };
                                } else {
                                    bullet[em].do = function () {
                                        this.force.y += this.mass * 0.0008
                                        this.rotateToVelocity()
                                    };
                                }
                                me.muzzleFlash();
                                if (me.onGround) {
                                    if (me.crouch) {
                                        const KNOCK = 0.03
                                        me.force.x -= KNOCK * Math.cos(me.angle2)
                                        me.force.y -= KNOCK * Math.sin(me.angle2) 
                                        Matter.Body.setVelocity(me, {
                                            x: me.velocity.x * 0.4,
                                            y: me.velocity.y * 0.4
                                        });
                                    } else {
                                        const KNOCK = 0.1
                                        me.force.x -= KNOCK * Math.cos(me.angle2)
                                        me.force.y -= KNOCK * Math.sin(me.angle2) 
                                        Matter.Body.setVelocity(me, {
                                            x: me.velocity.x * 0.7,
                                            y: me.velocity.y * 0.7
                                        });
                                    }
                                } else {
                                    me.force.x -= 0.2 * Math.cos(me.angle2) * Math.min(1, 3 / (0.1 + Math.abs(me.velocity.x)))
                                    me.force.y -= 0.02 * Math.sin(me.angle2) 
                                }
                            } else {
                                if (me.nextFireCycle + 1 < me.cycle) me.startingHoldCycle = me.cycle //reset if not constantly firing
                                const CD = Math.max(11 - 0.06 * (me.cycle - me.startingHoldCycle), 0.99) //CD scales with cycles fire is held down
                                me.nextFireCycle = me.cycle + CD * me.fireCDscale //predict next fire cycle if the fire button is held down

                                me.fireCDcycle = me.cycle + Math.floor(CD * me.fireCDscale); // cool down
                                me.baseFire(me.angle2 + (Math.random() - 0.5) * (me.crouch ? 0.04 : 0.13) / CD, 45 + 6 * Math.random())
                                //very complex recoil system
                                if (me.onGround) {
                                    if (me.crouch) {
                                        const KNOCK = 0.006
                                        me.force.x -= KNOCK * Math.cos(me.angle2)
                                        me.force.y -= KNOCK * Math.sin(me.angle2) //reduce knock back in vertical direction to stop super jumps
                                        Matter.Body.setVelocity(me, {
                                            x: me.velocity.x * 0.5,
                                            y: me.velocity.y * 0.5
                                        });
                                    } else {
                                        const KNOCK = 0.03
                                        me.force.x -= KNOCK * Math.cos(me.angle2)
                                        me.force.y -= KNOCK * Math.sin(me.angle2) //reduce knock back in vertical direction to stop super jumps
                                        Matter.Body.setVelocity(me, {
                                            x: me.velocity.x * 0.8,
                                            y: me.velocity.y * 0.8
                                        });
                                    }
                                } else {
                                    me.force.x -= 0.06 * Math.cos(me.angle2) * Math.min(1, 3 / (0.1 + Math.abs(me.velocity.x)))
                                    me.force.y -= 0.006 * Math.sin(me.angle2) //reduce knock back in vertical direction to stop super jumps
                                }
                            }
                        } else if (me.tech.isRivets) {
                            me.fireCDcycle = me.cycle + Math.floor((me.crouch ? 22 : 14) * me.fireCDscale); 
                            const em = bullet.length;
                            const size = me.tech.bulletSize * 8
                            bullet[em] = Bodies.rectangle(me.pos.x + 35 * Math.cos(me.angle2), me.pos.y + 35 * Math.sin(me.angle2), 5 * size, size, b2.fireAttributes(me.angle2, me.id));
                            bullet[em].dmg = me.tech.isNailRadiation ? 0 : 2.75
                            Matter.Body.setDensity(bullet[em], 0.002);
                            Composite.add(engine.world, bullet[em]); 
                            const SPEED = me.crouch ? 60 : 44
                            Matter.Body.setVelocity(bullet[em], {
                                x: SPEED * Math.cos(me.angle2),
                                y: SPEED * Math.sin(me.angle2)
                            });
                            bullet[em].endCycle = simulation.cycle + 180

                            bullet[em].beforeDmg = function (who) { 
                                if (me.tech.isIncendiary) {
                                    this.endCycle = 0; 
                                    b.explosion(this.position, 100 + (Math.random() - 0.5) * 20); 
                                }
                                if (me.tech.isNailCrit) {
                                    if (!who.shield && Vector.dot(Vector.normalise(Vector.sub(who.position, this.position)), Vector.normalise(this.velocity)) > 0.97 - 1 / who.radius) {
                                        b.explosion(this.position, 300 + 40 * Math.random()); 
                                    }
                                } else if (me.tech.isCritKill) b.crit(who, this)
                                if (me.tech.isNailRadiation) mobs.statusDoT(who, 7 * (me.tech.isFastRadiation ? 0.7 : 0.24), me.tech.isSlowRadiation ? 360 : (me.tech.isFastRadiation ? 60 : 180)) 
                                if (this.speed > 4 && me.tech.fragments) {
                                    b2.targetedNail(this.position, 1.25 * me.tech.fragments * me.tech.bulletSize, 40 + 10 * Math.random(), 1200, 1.4, me.id) //position, num = 1, speed = 40 + 10 * Math.random(), range = 1200, damage = 1.4
                                    this.endCycle = 0 
                                }
                            };

                            bullet[em].minDmgSpeed = 10
                            bullet[em].frictionAir = 0.006;
                            bullet[em].rotateToVelocity = function () { 
                                if (this.speed > 7) {
                                    const facing = {
                                        x: Math.cos(this.angle),
                                        y: Math.sin(this.angle)
                                    }
                                    const mag = 0.002 * this.mass
                                    if (Vector.cross(Vector.normalise(this.velocity), facing) < 0) {
                                        this.torque += mag
                                    } else {
                                        this.torque -= mag
                                    }
                                }
                            };
                            if (me.tech.isIncendiary) {
                                bullet[em].do = function () {
                                    this.force.y += this.mass * 0.0008
                                    this.rotateToVelocity()
                                    
                                    if (Matter.Query.collides(this, map).length) { 
                                        this.endCycle = 0; 
                                        b.explosion(this.position, 300 + 40 * Math.random()); 
                                    }
                                };
                            } else {
                                bullet[em].do = function () {
                                    this.force.y += this.mass * 0.0008
                                    this.rotateToVelocity()
                                };
                            }
                            me.muzzleFlash();
                            
                            if (me.onGround) {
                                if (me.crouch) {
                                    const KNOCK = 0.01
                                    me.force.x -= KNOCK * Math.cos(me.angle2)
                                    me.force.y -= KNOCK * Math.sin(me.angle2) 
                                } else {
                                    const KNOCK = 0.02
                                    me.force.x -= KNOCK * Math.cos(me.angle2)
                                    me.force.y -= KNOCK * Math.sin(me.angle2) 
                                }
                            } else {
                                const KNOCK = 0.01
                                me.force.x -= KNOCK * Math.cos(me.angle2)
                                me.force.y -= KNOCK * Math.sin(me.angle2) * 0.5 
                            }
                        } else if (me.tech.isNeedles) {
                            if (me.crouch) {
                                me.fireCDcycle = me.cycle + 30 * me.fireCDscale;
                                b2.needle(me.angle2, me.id)

                                function cycle() {
                                    if (simulation.paused || me.isTimeDilated) {
                                        requestAnimationFrame(cycle)
                                    } else {
                                        count++
                                        if (count % 2) b2.needle(me.angle2, me.id)
                                        if (count < 7 && me.alive) requestAnimationFrame(cycle);
                                    }
                                }
                                let count = -1
                                requestAnimationFrame(cycle);
                            } else {
                                me.fireCDcycle = me.cycle + 22 * me.fireCDscale;
                                b2.needle(me.angle2, me.id)

                                function cycle() {
                                    if (simulation.paused || me.isTimeDilated) {
                                        requestAnimationFrame(cycle)
                                    } else {
                                        count++
                                        if (count % 2) b2.needle(me.angle2, me.id)
                                        if (count < 3 && me.alive) requestAnimationFrame(cycle);
                                    }
                                }
                                let count = -1
                                requestAnimationFrame(cycle);
                            }
                        } else if (me.tech.nailInstantFireRate) {
                            me.fireCDcycle = me.cycle + Math.floor(1 * me.fireCDscale); // cool down
                            me.baseFire(me.angle2 + (Math.random() - 0.5) * (Math.random() - 0.5) * (me.crouch ? 1.15 : 2) / 2)
                        } else {
                            if (me.nextFireCycle + 1 < me.cycle) me.startingHoldCycle = me.cycle;
                        
                            const CD = Math.max(11 - 0.06 * (me.cycle - me.startingHoldCycle), 1);
                            me.nextFireCycle = me.cycle + Math.floor(CD * me.fireCDscale);
                            let speed = 30 + 6 * Math.random();
                            let angle = me.angle2 + (Math.random() - 0.5) * (Math.random() - 0.5) * (me.crouch ? 1.15 : 2) / 2;
                            b2.nail({
                                x: me.pos.x + 30 * Math.cos(me.angle2),
                                y: me.pos.y + 30 * Math.sin(me.angle2)
                            }, {
                                x: 0.8 * me.velocity.x + speed * Math.cos(angle),
                                y: 0.5 * me.velocity.y + speed * Math.sin(angle)
                            }, 1, me.id);
                        }
                    } else if(me.gunType == 1) { //shotgun
                        let knock, spread
                        const coolDown = function () {
                            if (me.crouch) {
                                spread = 0.65
                                me.fireCDcycle = me.cycle + Math.floor((73 + 36 * me.tech.shotgunExtraShots) * me.fireCDscale) // cool down
                                if (me.tech.isShotgunImmune && me.immuneCycle < me.cycle + Math.floor(60 * me.fireCDscale)) me.immuneCycle = me.cycle + Math.floor(60 * me.fireCDscale); //me is immune to damage for 30 cycles
                                knock = 0.01
                            } else {
                                me.fireCDcycle = me.cycle + Math.floor((56 + 28 * me.tech.shotgunExtraShots) * me.fireCDscale) // cool down
                                if (me.tech.isShotgunImmune && me.immuneCycle < me.cycle + Math.floor(47 * me.fireCDscale)) me.immuneCycle = me.cycle + Math.floor(47 * me.fireCDscale); //me is immune to damage for 30 cycles
                                spread = 1.3
                                knock = 0.1
                            }

                            if (me.tech.isShotgunReversed) {
                                me.force.x += 1.5 * knock * Math.cos(me.angle2)
                                me.force.y += 1.5 * knock * Math.sin(me.angle2) - 3 * me.mass * simulation.g
                            } else if (me.tech.isShotgunRecoil) {
                                me.fireCDcycle -= 0.66 * (56 * me.fireCDscale)
                                me.force.x -= 2 * knock * Math.cos(me.angle2)
                                me.force.y -= 2 * knock * Math.sin(me.angle2)
                            } else {
                                me.force.x -= knock * Math.cos(me.angle2)
                                me.force.y -= knock * Math.sin(me.angle2) * 0.5 //reduce knock back in vertical direction to stop super jumps
                            }
                        }
                        const spray = (num) => {
                            const side = 22
                            for (let i = 0; i < num; i++) {
                                const em = bullet.length;
                                const dir = me.angle2 + (Math.random() - 0.5) * spread
                                bullet[em] = Bodies.rectangle(me.pos.x, me.pos.y, side, side, b2.fireAttributes(dir, true, me.id));
                                Composite.add(engine.world, bullet[em]); //add bullet to world
                                const SPEED = 52 + Math.random() * 8
                                Matter.Body.setVelocity(bullet[em], {
                                    x: SPEED * Math.cos(dir),
                                    y: SPEED * Math.sin(dir)
                                });
                                bullet[em].endCycle = simulation.cycle + 40 * me.tech.bulletsLastLonger
                                bullet[em].minDmgSpeed = 15
                                if (me.tech.isShotgunReversed) Matter.Body.setDensity(bullet[em], 0.0015)
                                // bullet[em].restitution = 0.4
                                bullet[em].frictionAir = 0.034;
                                bullet[em].remoteBullet = true;
                                bullet[em].do = function () {
                                    const scale = 1 - 0.034 / me.tech.bulletsLastLonger
                                    Matter.Body.scale(this, scale, scale);
                                };
                            }
                        }
                        const chooseBulletType = function () {
                            if (me.tech.isRivets) {
                                const em = bullet.length;
                                // const dir = me.angle2 + 0.02 * (Math.random() - 0.5)
                                bullet[em] = Bodies.rectangle(me.pos.x + 35 * Math.cos(me.angle2), me.pos.y + 35 * Math.sin(me.angle2), 56 * me.tech.bulletSize, 25 * me.tech.bulletSize, b.fireAttributes(me.angle2));
                                bullet[em].remoteBullet = true;
                                Matter.Body.setDensity(bullet[em], 0.005 * (me.tech.isShotgunReversed ? 1.5 : 1));
                                Composite.add(engine.world, bullet[em]); //add bullet to world
                                const SPEED = (me.crouch ? 50 : 43)
                                Matter.Body.setVelocity(bullet[em], {
                                    x: SPEED * Math.cos(me.angle2),
                                    y: SPEED * Math.sin(me.angle2)
                                });
                                if (me.tech.isIncendiary) {
                                    bullet[em].endCycle = simulation.cycle + 60
                                    bullet[em].onEnd = function () {
                                        b.explosion(this.position, 400 + (Math.random() - 0.5) * 60); //makes bullet do explosive damage at end
                                    }
                                    bullet[em].beforeDmg = function () {
                                        this.endCycle = 0; //bullet ends cycle after hitting a mob and triggers explosion
                                    };
                                } else {
                                    bullet[em].endCycle = simulation.cycle + 180
                                }
                                bullet[em].minDmgSpeed = 7
                                // bullet[em].restitution = 0.4
                                bullet[em].frictionAir = 0.004;
                                bullet[em].turnMag = 0.04 * Math.pow(me.tech.bulletSize, 3.75)
                                bullet[em].do = function () {
                                    this.force.y += this.mass * 0.002
                                    if (this.speed > 6) { //rotates bullet to face current velocity?
                                        const facing = {
                                            x: Math.cos(this.angle),
                                            y: Math.sin(this.angle)
                                        }
                                        if (Vector.cross(Vector.normalise(this.velocity), facing) < 0) {
                                            this.torque += this.turnMag
                                        } else {
                                            this.torque -= this.turnMag
                                        }
                                    }
                                    if (me.tech.isIncendiary && Matter.Query.collides(this, map).length) {
                                        this.endCycle = 0; //bullet ends cycle after hitting a mob and triggers explosion
                                    }
                                };
                                bullet[em].beforeDmg = function (who) {
                                    if (this.speed > 4) {
                                        if (me.tech.fragments) {
                                            b2.targetedNail(this.position, 6 * me.tech.fragments * me.tech.bulletSize, 40 + 10 * Math.random(), 1200, 1.4, me.id) //position, num = 1, speed = 40 + 10 * Math.random(), range = 1200, damage = 1.4
                                            this.endCycle = 0 //triggers despawn
                                        }
                                        if (me.tech.isIncendiary) this.endCycle = 0; //bullet ends cycle after hitting a mob and triggers explosion
                                        if (me.tech.isCritKill) b.crit(who, this)
                                    }
                                }
                                spray(12); //fires normal shotgun bullets
                            } else if (me.tech.isIncendiary) {
                                spread *= 0.15
                                const END = Math.floor(me.crouch ? 8 : 5);
                                const totalBullets = 9
                                const angleStep = (me.crouch ? 0.3 : 0.8) / totalBullets
                                let dir = me.angle2 - angleStep * totalBullets / 2;
                                for (let i = 0; i < totalBullets; i++) { //5 -> 7
                                    dir += angleStep
                                    const em = bullet.length;
                                    bullet[em] = Bodies.rectangle(me.pos.x + 50 * Math.cos(me.angle2), me.pos.y + 50 * Math.sin(me.angle2), 17, 4, b2.fireAttributes(dir, true, me.id));
                                    bullet[em].remoteBullet = true;
                                    const end = END + Math.random() * 4
                                    bullet[em].endCycle = 2 * end * me.tech.bulletsLastLonger + simulation.cycle
                                    const speed = 25 * end / END
                                    const dirOff = dir + (Math.random() - 0.5) * spread
                                    Matter.Body.setVelocity(bullet[em], {
                                        x: speed * Math.cos(dirOff),
                                        y: speed * Math.sin(dirOff)
                                    });
                                    bullet[em].onEnd = function () {
                                        b.explosion(this.position, 180 * (me.tech.isShotgunReversed ? 1.4 : 1) + (Math.random() - 0.5) * 30); //makes bullet do explosive damage at end
                                    }
                                    bullet[em].beforeDmg = function () {
                                        this.endCycle = 0; //bullet ends cycle after hitting a mob and triggers explosion
                                    };
                                    bullet[em].do = function () {
                                        if (Matter.Query.collides(this, map).length) this.endCycle = 0; //bullet ends cycle after hitting a mob and triggers explosion
                                    }
                                    Composite.add(engine.world, bullet[em]); //add bullet to world
                                }
                            } else if (me.tech.isNailShot) {
                                spread *= 0.65
                                const dmg = 2 * (me.tech.isShotgunReversed ? 1.5 : 1)
                                if (me.crouch) {
                                    for (let i = 0; i < 17; i++) {
                                        speed = 38 + 15 * Math.random()
                                        const dir = me.angle2 + (Math.random() - 0.5) * spread
                                        const pos = {
                                            x: me.pos.x + 35 * Math.cos(me.angle2) + 15 * (Math.random() - 0.5),
                                            y: me.pos.y + 35 * Math.sin(me.angle2) + 15 * (Math.random() - 0.5)
                                        }
                                        b2.nail(pos, {
                                            x: speed * Math.cos(dir),
                                            y: speed * Math.sin(dir)
                                        }, dmg, me.id)
                                    }
                                } else {
                                    for (let i = 0; i < 17; i++) {
                                        speed = 38 + 15 * Math.random()
                                        const dir = me.angle2 + (Math.random() - 0.5) * spread
                                        const pos = {
                                            x: me.pos.x + 35 * Math.cos(me.angle2) + 15 * (Math.random() - 0.5),
                                            y: me.pos.y + 35 * Math.sin(me.angle2) + 15 * (Math.random() - 0.5)
                                        }
                                        b2.nail(pos, {
                                            x: speed * Math.cos(dir),
                                            y: speed * Math.sin(dir)
                                        }, dmg, me.id)
                                    }
                                }
                            } else if (me.tech.isSporeFlea) {
                                const where = {
                                    x: me.pos.x + 35 * Math.cos(me.angle2),
                                    y: me.pos.y + 35 * Math.sin(me.angle2)
                                }
                                const number = 2 * (me.tech.isShotgunReversed ? 1.5 : 1)
                                for (let i = 0; i < number; i++) {
                                    const angle = me.angle2 + 0.2 * (Math.random() - 0.5)
                                    const speed = (me.crouch ? 35 * (1 + 0.05 * Math.random()) : 30 * (1 + 0.15 * Math.random()))
                                    b.flea(where, {
                                        x: speed * Math.cos(angle),
                                        y: speed * Math.sin(angle)
                                    })
                                    bullet[bullet.length - 1].setDamage()
                                }
                                spray(10); //fires normal shotgun bullets
                            } else if (me.tech.isSporeWorm) {
                                const where = {
                                    x: me.pos.x + 35 * Math.cos(me.angle2),
                                    y: me.pos.y + 35 * Math.sin(me.angle2)
                                }
                                const spread = (me.crouch ? 0.02 : 0.07)
                                const number = 3 * (me.tech.isShotgunReversed ? 1.5 : 1)
                                let angle = me.angle2 - (number - 1) * spread * 0.5
                                for (let i = 0; i < number; i++) {
                                    b.worm(where)
                                    const SPEED = (30 + 10 * me.crouch) * (1 + 0.2 * Math.random())
                                    Matter.Body.setVelocity(bullet[bullet.length - 1], {
                                        x: me.velocity.x * 0.5 + SPEED * Math.cos(angle),
                                        y: me.velocity.y * 0.5 + SPEED * Math.sin(angle)
                                    });
                                    angle += spread
                                }
                                spray(7); //fires normal shotgun bullets
                            } else if (me.tech.isIceShot) {
                                const spread = (me.crouch ? 0.7 : 1.2)
                                for (let i = 0, len = 10 * (me.tech.isShotgunReversed ? 1.5 : 1); i < len; i++) {
                                    b2.iceIX(23 + 10 * Math.random(), me.angle2 + spread * (Math.random() - 0.5), {
                                        x: me.pos.x + 30 * Math.cos(me.angle2),
                                        y: me.pos.y + 30 * Math.sin(me.angle2)
                                    }, me.id)
                                }
                                spray(10); //fires normal shotgun bullets
                            } else if (me.tech.isFoamShot) {
                                const spread = (me.crouch ? 0.15 : 0.4)
                                const where = {
                                    x: me.pos.x + 25 * Math.cos(me.angle2),
                                    y: me.pos.y + 25 * Math.sin(me.angle2)
                                }
                                const number = 16 * (me.tech.isShotgunReversed ? 1.5 : 1)
                                for (let i = 0; i < number; i++) {
                                    const SPEED = 13 + 4 * Math.random();
                                    const angle = me.angle2 + spread * (Math.random() - 0.5)
                                    b.foam(where, {
                                        x: 0.6 * me.velocity.x + SPEED * Math.cos(angle),
                                        y: 0.5 * me.velocity.y + SPEED * Math.sin(angle)
                                    }, 8 + 7 * Math.random())
                                }
                            } else if (me.tech.isNeedles) {
                                const number = 9 * (me.tech.isShotgunReversed ? 1.5 : 1)
                                const spread = (me.crouch ? 0.03 : 0.05)
                                let angle = me.angle2 - (number - 1) * spread * 0.5
                                for (let i = 0; i < number; i++) {
                                    b2.needle(angle, me.id)
                                    angle += spread
                                }
                            } else {
                                spray(16);
                            }
                        }
                        coolDown();
                        me.muzzleFlash(35);
                        chooseBulletType();
                        if (me.tech.shotgunExtraShots) {
                            const delay = Math.ceil(7 * me.fireCDscale)
                            let count = me.tech.shotgunExtraShots * delay

                            function cycle() {
                                count--
                                if (!(count % delay)) {
                                    coolDown();
                                    me.muzzleFlash(35);
                                    chooseBulletType();
                                }
                                if (count > 0) {
                                    requestAnimationFrame(cycle);
                                }
                            }
                            requestAnimationFrame(cycle);
                        }
                    } else if (me.gunType == 2) { //super balls
                        if (me.tech.oneSuperBall) {
                            me.fireCDcycle = me.cycle + Math.floor((me.crouch ? 27 : 19) * me.fireCDscale); // cool down
                            const speed = me.crouch ? 43 : 36
                            b2.superBall({
                                x: me.pos.x + 30 * Math.cos(me.angle2),
                                y: me.pos.y + 30 * Math.sin(me.angle2)
                            }, {
                                x: speed * Math.cos(me.angle2),
                                y: speed * Math.sin(me.angle2)
                            }, 21 * me.tech.bulletSize, me.id)
                        } else if (me.tech.superBallDelay) {
                            me.fireCDcycle = me.cycle + Math.floor((me.crouch ? 23 : 15) * me.fireCDscale); // cool down
                            const num = 2 + 3 + Math.floor(me.tech.extraSuperBalls * Math.random()) //2 extra 
                            const speed = me.crouch ? 43 : 36

                            const delay = Math.floor((me.crouch ? 18 : 12) * me.fireCDscale)
                            me.fireCDcycle = me.cycle + delay; // cool down
                            function cycle() {
                                count++
                                b2.superBall({
                                    x: me.pos.x + 30 * Math.cos(me.angle2),
                                    y: me.pos.y + 30 * Math.sin(me.angle2)
                                }, {
                                    x: speed * Math.cos(me.angle2),
                                    y: speed * Math.sin(me.angle2)
                                }, 11 * me.tech.bulletSize, me.id)
                                if (count < num && me.alive) requestAnimationFrame(cycle);
                                me.fireCDcycle = me.cycle + delay; // cool down                  
                            }
                            let count = 0
                            requestAnimationFrame(cycle);
                        } else {
                            me.fireCDcycle = me.cycle + Math.floor((me.crouch ? 23 : 15) * me.fireCDscale); // cool down
                            const SPREAD = me.crouch ? 0.08 : 0.13
                            const num = 3 + Math.floor(me.tech.extraSuperBalls * Math.random())
                            const speed = me.crouch ? 43 : 36
                            if (me.tech.isBulletTeleport) {
                                for (let i = 0; i < num; i++) {
                                    b2.superBall({
                                        x: me.pos.x + 30 * Math.cos(me.angle2),
                                        y: me.pos.y + 30 * Math.sin(me.angle2)
                                    }, {
                                        x: speed * Math.cos(me.angle2),
                                        y: speed * Math.sin(me.angle2)
                                    }, 11 * me.tech.bulletSize, me.id)
                                }
                            } else {
                                let dir = me.angle2 - SPREAD * (num - 1) / 2;
                                for (let i = 0; i < num; i++) {
                                    b2.superBall({
                                        x: me.pos.x + 30 * Math.cos(dir),
                                        y: me.pos.y + 30 * Math.sin(dir)
                                    }, {
                                        x: speed * Math.cos(dir),
                                        y: speed * Math.sin(dir)
                                    }, 11 * me.tech.bulletSize, me.id)
                                    dir += SPREAD;
                                }
                            }
                        }
                    } else if (me.gunType == 3) { //wave
                        if (me.tech.isLongitudinal) {
                            if (me.tech.is360Longitudinal) {
                                me.fireCDcycle = me.cycle + Math.floor((me.crouch ? 4 : 8) * me.fireCDscale); 
                                me.waves.push({
                                    position: { x: me.pos.x, y: me.pos.y, },
                                    radius: 25,
                                    resonanceCount: 0 
                                })
                            } else {
                                me.fireCDcycle = me.cycle + Math.floor((me.crouch ? 4 : 8) * me.fireCDscale); // cool down
                                const halfArc = (me.crouch ? 0.0785 : 0.275) * (me.tech.isBulletTeleport ? 0.66 + (Math.random() - 0.5) : 1) //6.28 is a full circle, but these arcs needs to stay small because we are using small angle linear approximation, for collisions
                                const angle = me.angle2 + me.tech.isBulletTeleport * 0.3 * (Math.random() - 0.5)
                                me.waves.push({
                                    position: { x: me.pos.x + 25 * Math.cos(me.angle2), y: me.pos.y + 25 * Math.sin(me.angle2), },
                                    angle: angle - halfArc, //used in drawing ctx.arc
                                    unit1: { x: Math.cos(angle - halfArc), y: Math.sin(angle - halfArc) }, //used for collision
                                    unit2: { x: Math.cos(angle + halfArc), y: Math.sin(angle + halfArc) }, //used for collision
                                    arc: halfArc * 2,
                                    radius: 25,
                                    resonanceCount: 0
                                })
                            }
                        } else {
                            totalCycles = Math.floor((3.5) * 35 * me.tech.waveReflections * me.tech.bulletsLastLonger / Math.sqrt(me.tech.waveReflections * 0.5))
                            const em = bullet.length;
                            bullet[em] = Bodies.polygon(me.pos.x + 25 * Math.cos(me.angle2), me.pos.y + 25 * Math.sin(me.angle2), 5, 4, {
                                angle: me.angle2,
                                cycle: -0.5,
                                endCycle: simulation.cycle + totalCycles,
                                inertia: Infinity,
                                frictionAir: 0,
                                slow: 0,
                                // amplitude: (me.crouch ? 5 : 10) * ((this.wavePacketCycle % 2) ? -1 : 1) * Math.sin((this.wavePacketCycle + 1) * 0.088), //0.0968 //0.1012 //0.11 //0.088 //shorten wave packet
                                amplitude: (me.crouch ? 6 : 12) * ((this.wavePacketCycle % 2) ? -1 : 1) * Math.sin(this.wavePacketCycle * 0.088) * Math.sin(this.wavePacketCycle * 0.04), //0.0968 //0.1012 //0.11 //0.088 //shorten wave packet
                                minDmgSpeed: 0,
                                dmg: me.tech.waveBeamDamage * me.tech.wavePacketDamage * (me.tech.isBulletTeleport ? 1.43 : 1) * (me.tech.isInfiniteWaveAmmo ? 0.75 : 1), //also control damage when you divide by mob.mass 
                                dmgCoolDown: 0,
                                classType: "bullet",
                                collisionFilter: {
                                    category: 0,
                                    mask: 0, //cat.mob | cat.mobBullet | cat.mobShield
                                },
                                beforeDmg() { },
                                onEnd() { },
                                do() { },
                                query() {
                                    let slowCheck = 1
                                    if (Matter.Query.point(map, this.position).length) { //check if inside map                                    
                                        slowCheck = waveSpeedMap
                                    } else { //check if inside a body
                                        let q = Matter.Query.point(body, this.position)
                                        if (q.length) {
                                            slowCheck = waveSpeedBody
                                            Matter.Body.setPosition(this, Vector.add(this.position, q[0].velocity)) //move with the medium
                                        }
                                    }
                                    if (slowCheck !== this.slow) { //toggle velocity based on inside and outside status change
                                        this.slow = slowCheck
                                        Matter.Body.setVelocity(this, Vector.mult(Vector.normalise(this.velocity), me.tech.waveBeamSpeed * slowCheck));
                                    }

                                    if (this.dmgCoolDown < 1) {
                                        q = Matter.Query.point(mob, this.position) // check if inside a mob
                                        for (let i = 0; i < q.length; i++) {
                                            this.dmgCoolDown = 5 + Math.floor(8 * Math.random() * me.fireCDscale);
                                            let dmg = this.dmg
                                            if(q[i].id != me.id) {
                                                q[i].damage(dmg); 
                                                if (q[i].alive) {
                                                    q[i].foundPlayer();
                                                    Matter.Body.setVelocity(q[i], Vector.mult(q[i].velocity, 0.9))
                                                }
                                                // this.endCycle = 0; //bullet ends cycle after doing damage
                                                if (q[i].damageReduction) {
                                                    simulation.drawList.push({ //add dmg to draw queue
                                                        x: this.position.x,
                                                        y: this.position.y,
                                                        radius: Math.log(dmg + 1.1) * 40 * q[i].damageReduction + 3,
                                                        color: 'rgba(0,0,0,0.4)',
                                                        time: simulation.drawTime
                                                    });
                                                }
                                            } 
                                        }
                                    } else {
                                        this.dmgCoolDown--
                                    }
                                },
                                wiggle() {
                                    this.cycle++
                                    const where = Vector.mult(transverse, this.amplitude * Math.cos(this.cycle * me.tech.waveFrequency))
                                    Matter.Body.setPosition(this, Vector.add(this.position, where))
                                }
                            });
                            if (me.tech.isBulletTeleport) {
                                bullet[em].wiggle = function () {
                                    this.cycle++
                                    const where = Vector.mult(transverse, this.amplitude * Math.cos(this.cycle * me.tech.waveFrequency))
                                    if (Math.random() < 0.005) {
                                        if (Math.random() < 0.33) { //randomize position
                                            const scale = 500 * Math.random()
                                            Matter.Body.setPosition(this, Vector.add({
                                                x: scale * (Math.random() - 0.5),
                                                y: scale * (Math.random() - 0.5)
                                            }, Vector.add(this.position, where)))
                                        } else { //randomize position in velocity direction
                                            const velocityScale = Vector.mult(this.velocity, 50 * (Math.random() - 0.5))
                                            Matter.Body.setPosition(this, Vector.add(velocityScale, Vector.add(this.position, where)))
                                        }

                                    } else {
                                        Matter.Body.setPosition(this, Vector.add(this.position, where))
                                    }
                                }
                            }
                            let waveSpeedMap = 0.13
                            let waveSpeedBody = 0.3
                            if (me.tech.isPhaseVelocity) {
                                waveSpeedMap = 3.5
                                waveSpeedBody = 2
                                bullet[em].dmg *= 1.5
                            }
                            if (me.tech.waveReflections) {
                                bullet[em].reflectCycle = totalCycles / me.tech.waveReflections //me.tech.waveLengthRange
                                bullet[em].do = function () {
                                    this.query()
                                    if (this.cycle > this.reflectCycle) {
                                        this.reflectCycle += totalCycles / me.tech.waveReflections
                                        Matter.Body.setVelocity(this, Vector.mult(this.velocity, -1));
                                        // if (this.reflectCycle > me.tech.waveLengthRange * (1 + me.tech.waveReflections)) this.endCycle = 0;
                                    }
                                    this.wiggle()
                                }
                            } else {
                                bullet[em].do = function () {
                                    this.query()
                                    this.wiggle();
                                }
                            }
                            bullet[em].remoteBullet = true;
                            Composite.add(engine.world, bullet[em]); //add bullet to world
                            Matter.Body.setVelocity(bullet[em], {
                                x: me.tech.waveBeamSpeed * Math.cos(me.angle2),
                                y: me.tech.waveBeamSpeed * Math.sin(me.angle2)
                            });
                            const transverse = Vector.normalise(Vector.perp(bullet[em].velocity))
                            me.wavePacketCycle++
                        }
                    } else if (me.gunType == 4) { //missiles
                        const countReduction = Math.pow(0.86, me.tech.missileCount)
                        me.fireCDcycle = me.cycle + me.tech.missileFireCD * me.fireCDscale / countReduction; 
                        const direction = { x: Math.cos(me.angle2), y: Math.sin(me.angle2) }
                        if (me.tech.missileCount > 1) {
                            const push = Vector.mult(Vector.perp(direction), 0.2 * countReduction / Math.sqrt(me.tech.missileCount))
                            const sqrtCountReduction = Math.sqrt(countReduction)
                            const launchDelay = 4
                            let count = 0
                            const fireMissile = () => {
                                if (me.crouch) {
                                    b2.missile({ x: me.pos.x + 30 * direction.x, y: me.pos.y + 30 * direction.y }, me.angle2, 20, sqrtCountReduction, me.id)
                                    bullet[bullet.length - 1].force.x += 0.5 * push.x * (Math.random() - 0.5)
                                    bullet[bullet.length - 1].force.y += 0.004 + 0.5 * push.y * (Math.random() - 0.5)
                                } else {
                                    b2.missile({ x: me.pos.x + 30 * direction.x, y: me.pos.y + 30 * direction.y }, me.angle2, -15, sqrtCountReduction, me.id)
                                    bullet[bullet.length - 1].force.x += push.x * (Math.random() - 0.5)
                                    bullet[bullet.length - 1].force.y += 0.005 + push.y * (Math.random() - 0.5)
                                }
                            }
                            const cycle = () => {
                                if ((simulation.paused) && me.alive) {
                                    requestAnimationFrame(cycle)
                                } else {
                                    count++
                                    if (!(count % launchDelay)) {
                                        fireMissile()
                                    }
                                    if (count < me.tech.missileCount * launchDelay && me.alive) requestAnimationFrame(cycle);
                                }
                            }
                            requestAnimationFrame(cycle);
                        } else {
                            if (me.crouch) {
                                b2.missile({ x: me.pos.x + 40 * direction.x, y: me.pos.y + 40 * direction.y }, me.angle2, 25, 1, me.id)
                            } else {
                                b2.missile({ x: me.pos.x + 40 * direction.x, y: me.pos.y + 40 * direction.y }, me.angle2, -12, 1, me.id)
                                bullet[bullet.length - 1].force.y += 0.04 * (Math.random() - 0.2)
                            }
                        }
                    } else if (me.gunType == 5) { //grenades
                        const countReduction = Math.pow(0.93, me.tech.missileCount)
                        me.fireCDcycle = me.cycle + Math.floor((me.crouch ? 35 : 27) * me.fireCDscale / countReduction); // cool down
                        const where = {
                            x: me.pos.x + 30 * Math.cos(me.angle2),
                            y: me.pos.y + 30 * Math.sin(me.angle2)
                        }
                        const SPREAD = me.crouch ? 0.12 : 0.2
                        let angle = me.angle2 - SPREAD * (me.tech.missileCount - 1) / 2;
                        for (let i = 0; i < me.tech.missileCount; i++) {
                            b2.grenade(where, angle, countReduction, me.id) //function(where = { x: m.pos.x + 30 * Math.cos(m.angle), y: m.pos.y + 30 * Math.sin(m.angle) }, angle = m.angle, size = 1)
                            angle += SPREAD
                        }
                    } else if (me.gunType == 6) { //spores 
                        const em = bullet.length;
                        const dir = me.angle2;
                        bullet[em] = Bodies.polygon(me.pos.x + 30 * Math.cos(me.angle2), me.pos.y + 30 * Math.sin(me.angle2), 20, 4.5, b2.fireAttributes(dir, false, me.id));
                        b2.fireProps(me.crouch ? 40 : 20, me.crouch ? 24 : 18, dir, em, me.id); //cd , speed
                        Matter.Body.setDensity(bullet[em], 0.000001);
                        bullet[em].collisionFilter.group = -me.id;
                        bullet[em].remoteBullet = true;
                        bullet[em].endCycle = simulation.cycle + 480 + Math.max(0, 120 - 2 * bullet.length);
                        bullet[em].frictionAir = 0;
                        bullet[em].friction = 0.5;
                        bullet[em].radius = 4.5;
                        bullet[em].maxRadius = 30;
                        bullet[em].restitution = 0.3;
                        bullet[em].minDmgSpeed = 0;
                        bullet[em].totalSpores = 8 + 2 * me.tech.isSporeFreeze + 5 * me.tech.isSporeColony
                        bullet[em].stuck = function () { };
                        bullet[em].beforeDmg = function () { };
                        Matter.Body.setMass(bullet[em], bullet[em].mass / 8.9269321149);
                        bullet[em].do = function () {
                            function onCollide(that) {
                                that.collisionFilter.mask = 0; //non collide with everything
                                Matter.Body.setVelocity(that, { x: 0, y: 0 });
                                that.do = that.grow;
                            }
                            const validMobs = mob.filter(m => m.id !== id);
                            const mobCollisions = Matter.Query.collides(this, validMobs)
                            if (mobCollisions.length) {
                                if (mobCollisions[0].bodyA.id != me.id) {
                                    onCollide(this)
                                    this.stuckTo = mobCollisions[0].bodyA
                                    if (me.tech.isZombieMobs) this.stuckTo.isSoonZombie = true
                                    if (this.stuckTo.isVerticesChange) {
                                        this.stuckToRelativePosition = { x: 0, y: 0 }
                                    } else {
                                        //find the relative position for when the mob is at angle zero by undoing the mobs rotation
                                        this.stuckToRelativePosition = Vector.rotate(Vector.sub(this.position, this.stuckTo.position), -this.stuckTo.angle)
                                    }
                                    this.stuck = function () {
                                        if (this.stuckTo && this.stuckTo.alive) {
                                            const rotate = Vector.rotate(this.stuckToRelativePosition, this.stuckTo.angle) //add in the mob's new angle to the relative position vector
                                            Matter.Body.setPosition(this, Vector.add(Vector.add(rotate, this.stuckTo.velocity), this.stuckTo.position))
                                            Matter.Body.setVelocity(this, this.stuckTo.velocity); //so that it will move properly if it gets unstuck
                                        } else {
                                            this.collisionFilter.mask = cat.map; //non collide with everything but map
                                            this.stuck = function () {
                                                this.force.y += this.mass * 0.0006;
                                            }
                                        }
                                    }
                                }
                            } else {
                                const bodyCollisions = Matter.Query.collides(this, body)
                                if (bodyCollisions.length) {
                                    if (!bodyCollisions[0].bodyA.isNonStick) {
                                        onCollide(this)
                                        this.stuckTo = bodyCollisions[0].bodyA
                                        //find the relative position for when the mob is at angle zero by undoing the mobs rotation
                                        this.stuckToRelativePosition = Vector.rotate(Vector.sub(this.position, this.stuckTo.position), -this.stuckTo.angle)
                                    } else {
                                        this.do = this.grow;
                                    }
                                    this.stuck = function () {
                                        if (this.stuckTo) {
                                            const rotate = Vector.rotate(this.stuckToRelativePosition, this.stuckTo.angle) //add in the mob's new angle to the relative position vector
                                            Matter.Body.setPosition(this, Vector.add(Vector.add(rotate, this.stuckTo.velocity), this.stuckTo.position))
                                            // Matter.Body.setVelocity(this, this.stuckTo.velocity); //so that it will move properly if it gets unstuck
                                        } else {
                                            this.force.y += this.mass * 0.0007;
                                        }
                                    }
                                } else {
                                    if (Matter.Query.collides(this, map).length) {
                                        onCollide(this)
                                    } else { //if colliding with nothing just fall
                                        this.force.y += this.mass * 0.0007;
                                    }
                                }
                                const playerCollisions = Matter.Query.collides(this, [player]).filter(c => c.bodyA !== playerHead && c.bodyB !== playerHead);
                                if (playerCollisions.length) {
                                    if (!playerCollisions[0].bodyA.isNonStick) {
                                        onCollide(this)
                                        playerCollisions[0].bodyA.alive = true;
                                        this.stuckTo = playerCollisions[0].bodyA
                                        //find the relative position for when the mob is at angle zero by undoing the mobs rotation
                                        this.stuckToRelativePosition = Vector.rotate(Vector.sub(this.position, this.stuckTo.position), -this.stuckTo.angle)
                                    } else {
                                        this.do = this.grow;
                                    }
                                    this.stuck = function () {
                                        if (this.stuckTo) {
                                            const rotate = Vector.rotate(this.stuckToRelativePosition, this.stuckTo.angle) //add in the mob's new angle to the relative position vector
                                            Matter.Body.setPosition(this, Vector.add(Vector.add(rotate, this.stuckTo.velocity), this.stuckTo.position))
                                            // Matter.Body.setVelocity(this, this.stuckTo.velocity); //so that it will move properly if it gets unstuck
                                        } else {
                                            this.force.y += this.mass * 0.0007;
                                        }
                                    }
                                } else {
                                    if (Matter.Query.collides(this, map).length) {
                                        onCollide(this)
                                    } else { //if colliding with nothing just fall
                                        this.force.y += this.mass * 0.00007;
                                        me.mouse.x
                                    }
                                }
                            }
                            //draw green glow
                            ctx.fillStyle = "rgba(0,200,125,0.16)";
                            ctx.beginPath();
                            ctx.arc(this.position.x, this.position.y, this.maxRadius, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                        bullet[em].grow = function () {
                            this.stuck(); //runs different code based on what the bullet is stuck to
                            let scale = 1.01
                            if (me.tech.isSporeGrowth && !(simulation.cycle % 40)) { //release a spore
                                if (me.tech.isSporeFlea) {
                                    if (!(simulation.cycle % 80)) {
                                        const speed = 10 + 5 * Math.random()
                                        const angle = 2 * Math.PI * Math.random()
                                        b.flea(this.position, {
                                            x: speed * Math.cos(angle),
                                            y: speed * Math.sin(angle)
                                        })
                                    }
                                } else if (me.tech.isSporeWorm) {
                                    if (!(simulation.cycle % 80)) b.worm(this.position)
                                } else {
                                    b2.spore(this.position, null, me.id)
                                }
                                scale = 0.96
                                if (this.stuckTo && this.stuckTo.alive) scale = 0.9
                                Matter.Body.scale(this, scale, scale);
                                this.radius *= scale
                            } else {
                                if (this.stuckTo && (this.stuckTo.alive)) scale = 1.03
                                Matter.Body.scale(this, scale, scale);
                                this.radius *= scale
                                if (this.radius > this.maxRadius) this.endCycle = 0;
                            }
                            //draw green glow
                            ctx.fillStyle = "rgba(0,200,125,0.16)";
                            ctx.beginPath();
                            ctx.arc(this.position.x, this.position.y, this.maxRadius, 0, 2 * Math.PI);
                            ctx.fill();
                        };
                        //spawn bullets on end
                        bullet[em].onEnd = function () {
                            let count = 0 //used in for loop below
                            const things = [
                                () => { //spore
                                    b2.spore(this.position, null, me.id)
                                },
                                () => { //worm
                                    count++ //count as 2 things
                                    b2.worm(this.position, me.tech.isSporeFreeze, me.id)
                                },
                                () => { //flea
                                    count++ //count as 2 things
                                    const speed = 10 + 5 * Math.random()
                                    const angle = 2 * Math.PI * Math.random()
                                    b2.flea(this.position, {
                                        x: speed * Math.cos(angle),
                                        y: speed * Math.sin(angle)
                                    }, 6 + 3 * Math.random() + 10 * me.tech.wormSize * Math.random(), me.id)
                                },
                                () => { // drones
                                    b2.drone(this.position, 1, me.id)
                                },
                                () => { // ice IX
                                    b2.iceIX(1, Math.random() * 2 * Math.PI, this.position, me.id)
                                },
                                () => { //missile
                                    count++ //count as 2 things
                                    b2.missile(this.position, -Math.PI / 2 + 0.5 * (Math.random() - 0.5), 0, 1, me.id)
                                },
                                () => { //nail
                                    b2.targetedNail(this.position, 1, 39 + 6 * Math.random(), 1200, 1.4, me.id) // position, num = 1, speed = 40 + 10 * Math.random(), range = 1200, damage = 1.4
                                },
                                () => { //super ball
                                    const speed = 36
                                    const angle = 2 * Math.PI * Math.random()
                                    b2.superBall(this.position, {
                                        x: speed * Math.cos(angle),
                                        y: speed * Math.sin(angle)
                                    }, 11 * me.tech.bulletSize, me.id)
                                },
                            ]

                            for (len = this.totalSpores; count < len; count++) {
                                if (me.tech.isSporeColony && Math.random() < 0.33) {
                                    things[Math.floor(Math.random() * things.length)]()
                                } else if (me.tech.isSporeFlea) {
                                    things[2]()
                                } else if (me.tech.isSporeWorm) {
                                    things[1]()
                                } else {
                                    things[0]() //spores
                                }
                            }
                            // } else if (me.tech.isSporeFlea) {
                            //     for (let i = 0, len = this.totalSpores; i < len; i++) things[2]()
                            // } else if (me.tech.isSporeWorm) {
                            //     for (let i = 0, len = this.totalSpores; i < len; i++) things[1]()
                            // } else {
                            //     for (let i = 0; i < this.totalSpores; i++) things[0]()
                            // }
                            if (me.tech.isStun) b.AoEStunEffect(this.position, 600, 270 + 120 * Math.random()); //AoEStunEffect(where, range, cycles = 120 + 60 * Math.random()) {
                        }
                    } else if (me.gunType == 7) { //drones
                        if (me.tech.isDroneRadioactive) {
                            if (me.crouch) {
                                b2.droneRadioactive({
                                    x: me.pos.x + 30 * Math.cos(me.angle2) + 10 * (Math.random() - 0.5),
                                    y: me.pos.y + 30 * Math.sin(me.angle2) + 10 * (Math.random() - 0.5)
                                }, 45, me.id)
                                me.fireCDcycle = me.cycle + Math.floor(45 * me.fireCDscale); // cool down
                            } else {
                                b2.droneRadioactive({
                                    x: me.pos.x + 30 * Math.cos(me.angle2) + 10 * (Math.random() - 0.5),
                                    y: me.pos.y + 30 * Math.sin(me.angle2) + 10 * (Math.random() - 0.5)
                                }, 10, me.id)
                                me.fireCDcycle = me.cycle + Math.floor(25 * me.fireCDscale); // cool down
                            }
                        } else {
                            if (me.crouch) {
                                b2.drone({
                                    x: me.pos.x + 30 * Math.cos(me.angle2) + 5 * (Math.random() - 0.5),
                                    y: me.pos.y + 30 * Math.sin(me.angle2) + 5 * (Math.random() - 0.5)
                                }, 50, me.id)
                                me.fireCDcycle = me.cycle + Math.floor(4 * me.fireCDscale); // cool down
                            } else {
                                b2.drone({
                                    x: me.pos.x + 30 * Math.cos(me.angle2) + 10 * (Math.random() - 0.5),
                                    y: me.pos.y + 30 * Math.sin(me.angle2) + 10 * (Math.random() - 0.5)
                                }, 15, me.id)
                                me.fireCDcycle = me.cycle + Math.floor(3 * me.fireCDscale); // cool down
                            }
                        }
                    } else if (me.gunType == 8) { //foam
                        if (me.tech.isFoamPressure) {
                            const spread = (me.crouch ?
                                0.04 * (Math.random() - 0.5) + 0.09 * Math.sin(me.cycle * 0.12) :
                                0.23 * (Math.random() - 0.5) + 0.15 * Math.sin(me.cycle * 0.12)
                            )
                            const radius = 5 + 8 * Math.random() + (me.tech.isAmmoFoamSize && this.ammo < 300) * 12
                            const SPEED = (me.crouch ? 1.2 : 1) * Math.max(2, 14 - radius * 0.25)
                            const dir = me.angle2 + 0.15 * (Math.random() - 0.5)
                            const velocity = {
                                x: 0.7 * me.velocity.x + SPEED * Math.cos(dir),
                                y: 0.5 * me.velocity.y + SPEED * Math.sin(dir)
                            }
                            const position = { x: me.pos.x + 30 * Math.cos(me.angle2), y: me.pos.y + 30 * Math.sin(me.angle2) }

                            b2.foam(position, Vector.rotate(velocity, spread), radius, me.id)
                            me.applyKnock(velocity)
                            me.fireCDcycle = me.cycle + Math.floor(1.5 * me.fireCDscale);
                            this.charge += 1 + me.tech.isCapacitor
                        } else {
                            const spread = (me.crouch ?
                                0.04 * (Math.random() - 0.5) + 0.09 * Math.sin(me.cycle * 0.12) :
                                0.23 * (Math.random() - 0.5) + 0.15 * Math.sin(me.cycle * 0.12)
                            )
                            const radius = 5 + 8 * Math.random() + (me.tech.isAmmoFoamSize && this.ammo < 300) * 12
                            const SPEED = (me.crouch ? 1.2 : 1) * Math.max(2, 14 - radius * 0.25)
                            const dir = me.angle2 + 0.15 * (Math.random() - 0.5)
                            const velocity = {
                                x: 0.7 * me.velocity.x + SPEED * Math.cos(dir),
                                y: 0.5 * me.velocity.y + SPEED * Math.sin(dir)
                            }
                            const position = { x: me.pos.x + 30 * Math.cos(me.angle2), y: me.pos.y + 30 * Math.sin(me.angle2) }
                            b2.foam(position, Vector.rotate(velocity, spread), radius, me.id)
                            me.applyKnock(velocity)
                            me.fireCDcycle = me.cycle + Math.floor(1.5 * me.fireCDscale);
                        }
                    } else if (me.gunType == 9) { //harpoon
                        if (me.tech.isRailGun) {
                            me.fireCDcycle = me.cycle + 10 //can't fire until mouse is released
                            this.charge += 0.00001
                        } else {
                            const where = {
                                x: me.pos.x + 30 * Math.cos(me.angle2),
                                y: me.pos.y + 30 * Math.sin(me.angle2)
                            }
                            const closest = {
                                distance: 10000,
                                target: null
                            }
                            //look for closest mob in player's LoS
                            const harpoonSize = (me.tech.isLargeHarpoon ? 1 + 0.1 * Math.sqrt(this.ammo) : 1) //* (me.crouch ? 0.7 : 1)
                            const totalCycles = 6.5 * (me.tech.isFilament ? 1 + 0.013 * Math.min(110, this.ammo) : 1) * Math.sqrt(harpoonSize)

                            if (me.tech.extraHarpoons && !me.crouch) { //multiple harpoons
                                const SPREAD = 0.2
                                let angle = me.angle2 - SPREAD * me.tech.extraHarpoons / 2;
                                const dir = { x: Math.cos(angle), y: Math.sin(angle) }; //make a vector for the player's direction of length 1; used in dot product
                                const range = 450 * (me.tech.isFilament ? 1 + 0.012 * Math.min(110, this.ammo) : 1)
                                let targetCount = 0
                                const candidates = [...mob];
                                if (m.alive) candidates.push(player);
                                for (let i = 0, len = candidates.length; i < len; ++i) {
                                    const target = candidates[i];
                                    if ((target == player ? m.alive : target.alive) && !target.isBadTarget && !target.shield && 
                                        Matter.Query.ray(map, me.pos, target.position).length === 0 && 
                                        !target.isInvulnerable && target.id !== me.id) {
                                        
                                        const dot = Vector.dot(dir, Vector.normalise(Vector.sub(target.position, me.pos)));
                                        const dist = Vector.magnitude(Vector.sub(where, target.position));
                                        if (dist < range && dot > 0.9) {
                                            if (this.ammo > 0) {
                                                b2.harpoon(where, target, angle, harpoonSize, true, totalCycles, true, 0.1, me.id);
                                                angle += SPREAD;
                                                targetCount++;
                                                if (targetCount > me.tech.extraHarpoons) break;
                                            }
                                        }
                                    }
                                }
                                //if more harpoons and no targets left
                                if (targetCount < me.tech.extraHarpoons + 1) {
                                    const num = me.tech.extraHarpoons - targetCount
                                    const delay = 1 //Math.floor(Math.max(4, 8 - 0.5 * me.tech.extraHarpoons))
                                    let angle = me.angle2 - SPREAD * me.tech.extraHarpoons / 2;
                                    let count = -1
                                    let harpoonDelay = () => {
                                        if (simulation.paused) {
                                            requestAnimationFrame(harpoonDelay)
                                        } else {
                                            count++
                                            if (!(count % delay) && this.ammo > 0) {
                                                b2.harpoon({ x: me.pos.x + 30 * Math.cos(me.angle2), y: me.pos.y + 30 * Math.sin(me.angle2) }, null, angle, harpoonSize, true, totalCycles, true, 0.1, me.id)
                                                angle += SPREAD
                                            }
                                            if (count < num * delay && me.alive) requestAnimationFrame(harpoonDelay);
                                        }
                                    }
                                    requestAnimationFrame(harpoonDelay)
                                }
                            } else { //me.crouch makes a single harpoon with longer range
                               const dir = { x: Math.cos(me.angle2), y: Math.sin(me.angle2) };
                                const candidates = [...mob];
                                if (m.alive) candidates.push(player);
                                for (let i = 0, len = candidates.length; i < len; ++i) {
                                    const target = candidates[i];
                                    if ((target == player ? m.alive : target.alive) && !target.isBadTarget && Matter.Query.ray(map, me.pos, target.position).length === 0 && !target.isInvulnerable) {
                                        const dot = Vector.dot(dir, Vector.normalise(Vector.sub(target.position, me.pos)));
                                        const dist = Vector.magnitude(Vector.sub(where, target.position));
                                        if (dist < closest.distance && dot > 0.98 - Math.min(dist * 0.00014, 0.3)) {
                                            closest.distance = dist;
                                            closest.target = target;
                                        }
                                    }
                                }
                                if (me.crouch && me.onGround) {
                                    b2.harpoon(where, null, me.angle2, harpoonSize, true, 1.6 * totalCycles, (me.crouch && me.tech.crouchAmmoCount && (me.tech.crouchAmmoCount - 1) % 2) ? false : true, 0.1, me.id) 
                                } else {
                                    b2.harpoon(where, closest.target, me.angle2, harpoonSize, true, totalCycles, true, 0.1, me.id)
                                }
                            }
                            me.fireCDcycle = me.cycle + 5 + 35 * me.fireCDscale * (me.tech.isBreakHarpoon ? 0.5 : 1) + 60 * (me.energy < 0.05) + me.tech.extraHarpoons
                            const recoil = Vector.mult(Vector.normalise(Vector.sub(where, me.pos)), me.crouch ? 0.015 : 0.035)
                            me.force.x -= recoil.x
                            me.force.y -= recoil.y
                        }
                    } else if (me.gunType == 10) { //mines
                        if (me.crouch) {
                            if (me.tech.isLaserMine) {
                                const speed = 30
                                const velocity = {
                                    x: speed * Math.cos(me.angle2),
                                    y: speed * Math.sin(me.angle2)
                                }
                                b2.laserMine(me.pos, velocity, me.id)
                                me.fireCDcycle = me.cycle + Math.floor(65 * me.fireCDscale); // cool down
                            } else {
                                const pos = {
                                    x: me.pos.x + 30 * Math.cos(me.angle2),
                                    y: me.pos.y + 30 * Math.sin(me.angle2)
                                }
                                let speed = 36
                                if (Matter.Query.point(map, pos).length > 0) speed = -2 //don't launch if mine will spawn inside map
                                b2.mine(pos, { x: speed * Math.cos(me.angle2), y: speed * Math.sin(me.angle2) }, 0, me.id)
                                me.fireCDcycle = me.cycle + Math.floor(55 * me.fireCDscale); // cool down
                            }
                        } else {
                            const pos = {
                                x: me.pos.x + 30 * Math.cos(me.angle2),
                                y: me.pos.y + 30 * Math.sin(me.angle2)
                            }
                            let speed = 23
                            if (Matter.Query.point(map, pos).length > 0) speed = -2 //don't launch if mine will spawn inside map
                            b2.mine(pos, { x: speed * Math.cos(me.angle2), y: speed * Math.sin(me.angle2) }, 0, me.id)
                            me.fireCDcycle = me.cycle + Math.floor(35 * me.fireCDscale); // cool down
                        }
                    } else if (me.gunType == 11) { //laser
                        if (me.tech.isLaserLens) {
                            me.lens();
                        } else {
                            me.stuckOn();
                        }
                        if (me.tech.isPulseLaser) {
                            const drain = Math.min(0.9 * me.maxEnergy, 0.01 * (me.tech.isCapacitor ? 10 : 1) / me.fireCDscale)
                            if (me.energy > drain && me.charge < 50 * me.maxEnergy) {
                                me.energy -= drain
                                me.charge += drain * 100
                            }
                        } else if (me.tech.beamCollimator) {
                            const drain = me.tech.laserDrain / me.fireCDscale
                            if (me.energy < drain) {
                                me.fireCDcycle = me.cycle + 100; // cool down if out of energy
                            } else {
                                me.fireCDcycle = me.cycle
                                me.energy -= drain
                                const freq = 0.037
                                const len = me.tech.beamSplitter + 1
                                const phase = 2 * Math.PI / len
                                for (let i = 0; i < len; i++) {
                                    if (Math.sin(me.cycle * freq + phase * (i) + Math.PI / 2) > 0 || !(me.cycle % 3)) ctx.globalAlpha = 0.35

                                    const whereSweep = me.angle2 + (me.crouch ? 0.4 : 1) * (Math.sin(me.cycle * freq + phase * (i)))
                                    const where = { x: me.pos.x + 30 * Math.cos(whereSweep), y: me.pos.y + 30 * Math.sin(whereSweep) }
                                    b2.laser(where, {
                                        x: where.x + 5000 * Math.cos(me.angle2),
                                        y: where.y + 5000 * Math.sin(me.angle2)
                                    }, me.tech.laserDamage / me.fireCDscale * me.lensDamage, me.tech.laserReflections, false, 1, me.id); //where, whereEnd, damage, reflections, isThickBeam, push, id
                                    ctx.globalAlpha = 1
                                }
                            }
                        } else if (me.tech.beamSplitter) {
                            const drain = me.tech.laserDrain / me.fireCDscale
                            if (me.energy < drain) {
                                me.fireCDcycle = me.cycle + 100; // cool down if out of energy
                            } else {
                                me.fireCDcycle = me.cycle
                                me.energy -= drain
                                // const divergence = me.crouch ? 0.15 : 0.2
                                // const scale = Math.pow(0.9, me.tech.beamSplitter)
                                // const pushScale = scale * scale
                                let dmg = me.tech.laserDamage / me.fireCDscale * this.lensDamage
                                const where = { x: me.pos.x + 20 * Math.cos(me.angle2), y: me.pos.y + 20 * Math.sin(me.angle2) }
                                const divergence = me.crouch ? 0.15 : 0.35
                                const angle = me.angle2 - me.tech.beamSplitter * divergence / 2
                                for (let i = 0; i < 1 + me.tech.beamSplitter; i++) {
                                    b2.laser(where, {
                                        x: where.x + 3000 * Math.cos(angle + i * divergence),
                                        y: where.y + 3000 * Math.sin(angle + i * divergence)
                                    }, dmg, me.tech.laserReflections, false, 1, me.id)
                                }
                            }
                        } else if (me.tech.historyLaser) {
                            drain = me.tech.laserDrain / me.fireCDscale
                            if (me.energy < drain) {
                                me.fireCDcycle = me.cycle + 100; // cool down if out of energy
                            } else {
                                me.fireCDcycle = me.cycle
                                me.energy -= drain
                                const dmg = me.tech.laserDamage / me.fireCDscale * me.lensDamage
                                const spacing = Math.ceil(23 - me.tech.historyLaser)
                                ctx.beginPath();
                                b2.laser({
                                    x: me.pos.x + 20 * Math.cos(me.angle2),
                                    y: me.pos.y + 20 * Math.sin(me.angle2)
                                }, {
                                    x: me.pos.x + 3000 * Math.cos(me.angle2),
                                    y: me.pos.y + 3000 * Math.sin(me.angle2)
                                }, dmg, me.tech.laserReflections, false, 1, me.id);

                                for (let i = 1, len = 1 + me.tech.historyLaser; i < len; i++) {
                                    const history = me.history[(simulation.cycle - i * spacing) % 600]
                                    const off = history.yOff - 24.2859 + 2 * i
                                    // ctx.globalAlpha = 0.13
                                    b2.laser({
                                        x: history.position.x + 20 * Math.cos(history.angle),
                                        y: history.position.y + 20 * Math.sin(history.angle) - off
                                    }, {
                                        x: history.position.x + 3000 * Math.cos(history.angle),
                                        y: history.position.y + 3000 * Math.sin(history.angle) - off
                                    }, 0.7 * dmg, me.tech.laserReflections, true, 1, me.id);
                                }
                                // ctx.globalAlpha = 1
                                ctx.strokeStyle = me.tech.laserColor;
                                ctx.lineWidth = 1
                                ctx.stroke();
                                if (me.tech.isLaserLens && me.lensDamage !== 1) {
                                    ctx.strokeStyle = me.tech.laserColor;
                                    ctx.lineWidth = 10 + 2 * me.lensDamageOn
                                    ctx.globalAlpha = 0.2
                                    ctx.stroke(); //glow
                                    ctx.globalAlpha = 1;
                                }
                            }
                        } else if (me.tech.isWideLaser) {
                            const drain = me.tech.laserDrain / me.fireCDscale
                            if (me.energy < drain) {
                                me.fireCDcycle = me.cycle + 100; // cool down if out of energy
                            } else {
                                me.fireCDcycle = me.cycle
                                me.energy -= drain
                                const range = {
                                    x: 5000 * Math.cos(me.angle2),
                                    y: 5000 * Math.sin(me.angle2)
                                }
                                const rangeOffPlus = {
                                    x: 7.5 * Math.cos(me.angle2 + Math.PI / 2),
                                    y: 7.5 * Math.sin(me.angle2 + Math.PI / 2)
                                }
                                const rangeOffMinus = {
                                    x: 7.5 * Math.cos(me.angle2 - Math.PI / 2),
                                    y: 7.5 * Math.sin(me.angle2 - Math.PI / 2)
                                }
                                const dmg = 0.70 * me.tech.laserDamage / me.fireCDscale * me.lensDamage //  3.5 * 0.55 = 200% more damage
                                const where = {
                                    x: me.pos.x + 30 * Math.cos(me.angle2),
                                    y: me.pos.y + 30 * Math.sin(me.angle2)
                                }
                                const eye = {
                                    x: me.pos.x + 15 * Math.cos(me.angle2),
                                    y: me.pos.y + 15 * Math.sin(me.angle2)
                                }
                                ctx.strokeStyle = me.tech.laserColor;
                                ctx.lineWidth = 8
                                ctx.globalAlpha = 0.5;
                                ctx.beginPath();
                                if (Matter.Query.ray(map, eye, where).length === 0 && Matter.Query.ray(body, eye, where).length === 0) {
                                    b2.laser(eye, {
                                        x: eye.x + range.x,
                                        y: eye.y + range.y
                                    }, dmg, 0, true, 0.3, me.id)
                                }
                                for (let i = 1; i < me.tech.wideLaser; i++) {
                                    let whereOff = Vector.add(where, {
                                        x: i * rangeOffPlus.x,
                                        y: i * rangeOffPlus.y
                                    })
                                    if (Matter.Query.ray(map, eye, whereOff).length === 0 && Matter.Query.ray(body, eye, whereOff).length === 0) {
                                        ctx.moveTo(eye.x, eye.y)
                                        ctx.lineTo(whereOff.x, whereOff.y)
                                        b2.laser(whereOff, {
                                            x: whereOff.x + range.x,
                                            y: whereOff.y + range.y
                                        }, dmg, 0, true, 0.3, me.id)
                                    }
                                    whereOff = Vector.add(where, {
                                        x: i * rangeOffMinus.x,
                                        y: i * rangeOffMinus.y
                                    })
                                    if (Matter.Query.ray(map, eye, whereOff).length === 0 && Matter.Query.ray(body, eye, whereOff).length === 0) {
                                        ctx.moveTo(eye.x, eye.y)
                                        ctx.lineTo(whereOff.x, whereOff.y)
                                        b2.laser(whereOff, {
                                            x: whereOff.x + range.x,
                                            y: whereOff.y + range.y
                                        }, dmg, 0, true, 0.3, me.id)
                                    }
                                }
                                ctx.stroke();
                                if (me.tech.isLaserLens && me.lensDamage !== 1) {
                                    ctx.lineWidth = 20 + 3 * me.lensDamageOn
                                    ctx.globalAlpha = 0.3
                                    ctx.stroke();
                                }
                                ctx.globalAlpha = 1;
                            }
                        } else {
                            const drain = me.tech.laserDrain / me.fireCDscale
                            if (me.energy < drain) {
                                me.fireCDcycle = me.cycle + 100; // cool down if out of energy
                            } else {
                                me.fireCDcycle = me.cycle
                                me.energy -= drain
                                const where = { x: me.pos.x + 20 * Math.cos(me.angle2), y: me.pos.y + 20 * Math.sin(me.angle2) }
                                b2.laser(where, {
                                    x: where.x + 5000 * Math.cos(me.angle2),
                                    y: where.y + 5000 * Math.sin(me.angle2)
                                }, me.tech.laserDamage / me.fireCDscale * me.lensDamage, me.tech.laserReflections, false, 1, me.id); //, me.tech.laserReflections, false, 1, me.id
                            }
                        }
                    }
                }
                if(me.tech.isLongitudinal) {
                    if(me.tech.is360Longitudinal) {
                        if (!me.isTimeDilated) {
                            ctx.strokeStyle = "rgba(0,0,0,0.6)" 
                            ctx.lineWidth = 2 * me.tech.wavePacketDamage
                            ctx.beginPath();
                            const end = 700 * Math.sqrt(me.tech.bulletsLastLonger)
                            const damage = 2.3 * me.tech.wavePacketDamage * me.tech.waveBeamDamage * (me.tech.isBulletTeleport ? 1.43 : 1) * (me.tech.isInfiniteWaveAmmo ? 0.75 : 1) 
                            for (let i = me.waves.length - 1; i > -1; i--) {
                                ctx.moveTo(me.waves[i].position.x + me.waves[i].radius, me.waves[i].position.y)
                                ctx.arc(me.waves[i].position.x, me.waves[i].position.y, me.waves[i].radius, 0, 2 * Math.PI);
                                const dist2 = Vector.magnitude(Vector.sub(me.waves[i].position, player.position))
                                if (dist2 + 30 > me.waves[i].radius && dist2 - 30 < me.waves[i].radius) {
                                    player.force.x += 0.01 * (Math.random() - 0.5) * player.mass
                                    player.force.y += 0.01 * (Math.random() - 0.5) * player.mass
                                    Matter.Body.setVelocity(player, { 
                                        x: player.velocity.x * 0.95,
                                        y: player.velocity.y * 0.95
                                    });
                                    m.takeDamage(damage / Math.sqrt(30) / 100);
                                    if (me.tech.isPhononWave && me.phononWaveCD < me.cycle) {
                                        me.phononWaveCD = me.cycle + 8 * (1 + me.waves[i].resonanceCount)
                                        me.waves.push({
                                            position: player.position,
                                            radius: 25,
                                            resonanceCount: me.waves[i].resonanceCount + 1,
                                        })
                                    }
                                }
                                for (let j = 0, len = mob.length; j < len; j++) {
                                    if (!mob[j].isShielded && !mob[j].remotePlayer) {
                                        const dist = Vector.magnitude(Vector.sub(me.waves[i].position, mob[j].position))
                                        const r = mob[j].radius + 30
                                        if (dist + r > me.waves[i].radius && dist - r < me.waves[i].radius) {
                                            if (!mob[j].isBadTarget) {
                                                mob[j].force.x += 0.01 * (Math.random() - 0.5) * mob[j].mass
                                                mob[j].force.y += 0.01 * (Math.random() - 0.5) * mob[j].mass
                                            }
                                            Matter.Body.setVelocity(mob[j], { 
                                                x: mob[j].velocity.x * 0.95,
                                                y: mob[j].velocity.y * 0.95
                                            });
                                            let vertices = mob[j].vertices;
                                            const vibe = 50 + mob[j].radius * 0.15
                                            ctx.moveTo(vertices[0].x + vibe * (Math.random() - 0.5), vertices[0].y + vibe * (Math.random() - 0.5));
                                            for (let k = 1; k < vertices.length; k++) {
                                                ctx.lineTo(vertices[k].x + vibe * (Math.random() - 0.5), vertices[k].y + vibe * (Math.random() - 0.5));
                                            }
                                            ctx.lineTo(vertices[0].x + vibe * (Math.random() - 0.5), vertices[0].y + vibe * (Math.random() - 0.5));
                                            mob[j].damage(damage / Math.sqrt(mob[j].radius));
                                            if (me.tech.isPhononWave && me.phononWaveCD < me.cycle) {
                                                me.phononWaveCD = me.cycle + 8 * (1 + me.waves[i].resonanceCount)
                                                me.waves.push({
                                                    position: mob[j].position,
                                                    radius: 25,
                                                    resonanceCount: me.waves[i].resonanceCount + 1,
                                                })
                                            }
                                        }
                                    }
                                }
                                
                                for (let j = 0, len = Math.min(30, body.length); j < len; j++) {
                                    const dist = Vector.magnitude(Vector.sub(me.waves[i].position, body[j].position))
                                    const r = 20
                                    if (dist + r > me.waves[i].radius && dist - r < me.waves[i].radius) {
                                        const who = body[j]
                                        
                                        who.force.x += 0.01 * (Math.random() - 0.5) * who.mass
                                        who.force.y += (0.01 * (Math.random() - 0.5) - simulation.g * 0.25) * who.mass 
                                        
                                        let vertices = who.vertices;
                                        const vibe = 25
                                        ctx.moveTo(vertices[0].x + vibe * (Math.random() - 0.5), vertices[0].y + vibe * (Math.random() - 0.5));
                                        for (let k = 1; k < vertices.length; k++) {
                                            ctx.lineTo(vertices[k].x + vibe * (Math.random() - 0.5), vertices[k].y + vibe * (Math.random() - 0.5));
                                        }
                                        ctx.lineTo(vertices[0].x + vibe * (Math.random() - 0.5), vertices[0].y + vibe * (Math.random() - 0.5));

                                        if (me.tech.isPhononBlock && !who.isNotHoldable && who.speed < 5 && who.angularSpeed < 0.1) {
                                            if (Math.random() < 0.5) b.targetedBlock(who, 50 - Math.min(25, who.mass * 3)) 
                                            
                                            who.torque += who.inertia * 0.001 * (Math.random() - 0.5)
                                        }
                                    }
                                }
                                me.waves[i].radius += 0.9 * me.tech.waveBeamSpeed 
                                
                                if (me.waves[i].radius > end - 30 * me.waves[i].resonanceCount) { 
                                    me.waves.splice(i, 1) 
                                }
                            }
                            ctx.stroke();
                        }
                    } else {
                        if (!me.isTimeDilated) {
                            ctx.strokeStyle = "rgba(0,0,0,0.6)" //"000";
                            ctx.lineWidth = 2 * me.tech.wavePacketDamage
                            ctx.beginPath();
                            const end = 1100 * me.tech.bulletsLastLonger
                            const damage = 2.3 * me.tech.wavePacketDamage * me.tech.waveBeamDamage * (me.tech.isBulletTeleport ? 1.4 : 1) * (me.tech.isInfiniteWaveAmmo ? 0.75 : 1) //damage is lower for large radius mobs, since they feel the waves longer
                            for (let i = me.waves.length - 1; i > -1; i--) {
                                const v1 = Vector.add(me.waves[i].position, Vector.mult(me.waves[i].unit1, me.waves[i].radius))
                                const v2 = Vector.add(me.waves[i].position, Vector.mult(me.waves[i].unit2, me.waves[i].radius))
                                //draw wave
                                ctx.moveTo(v1.x, v1.y)
                                ctx.arc(me.waves[i].position.x, me.waves[i].position.y, me.waves[i].radius, me.waves[i].angle, me.waves[i].angle + me.waves[i].arc);
                                //using small angle linear approximation of circle arc, this will not work if the arc gets large   // https://stackoverflow.com/questions/13652518/efficiently-find-points-inside-a-circle-sector
                                let hits2 = Matter.Query.ray(player, v1, v2, 50) //Matter.Query.ray(bodies, startPoint, endPoint, [rayWidth])
                                for (let j = 0; j < hits2.length; j++) {   
                                    who.force.x += 0.01 * (Math.random() - 0.5) * who.mass
                                    who.force.y += 0.01 * (Math.random() - 0.5) * who.mass
                                    Matter.Body.setVelocity(who, { x: who.velocity.x * 0.95, y: who.velocity.y * 0.95 });
                                    const vibe = 50 + 30 * 0.15
                                    m.takeDamage(damage / Math.sqrt(30) / 100);
                                }
                                let hits = Matter.Query.ray(mob, v1, v2, 50) //Matter.Query.ray(bodies, startPoint, endPoint, [rayWidth])
                                for (let j = 0; j < hits.length; j++) {
                                    const who = hits[j].body
                                    if (!who.isShielded && !who.remotePlayer) {
                                        who.force.x += 0.01 * (Math.random() - 0.5) * who.mass
                                        who.force.y += 0.01 * (Math.random() - 0.5) * who.mass
                                        Matter.Body.setVelocity(who, { x: who.velocity.x * 0.95, y: who.velocity.y * 0.95 });
                                        let vertices = who.vertices;
                                        const vibe = 50 + who.radius * 0.15
                                        ctx.moveTo(vertices[0].x + vibe * (Math.random() - 0.5), vertices[0].y + vibe * (Math.random() - 0.5));
                                        for (let j = 1; j < vertices.length; j++) ctx.lineTo(vertices[j].x + vibe * (Math.random() - 0.5), vertices[j].y + vibe * (Math.random() - 0.5));
                                        ctx.lineTo(vertices[0].x + vibe * (Math.random() - 0.5), vertices[0].y + vibe * (Math.random() - 0.5));
                                        if(typeof who.damage == "function") who.damage(damage / Math.sqrt(who.radius));

                                        if (me.tech.isPhononWave && me.phononWaveCD < me.cycle) {
                                            me.phononWaveCD = me.cycle + 8 * (1 + me.waves[i].resonanceCount)
                                            const halfArc = 0.27 //6.28 is a full circle, but these arcs needs to stay small because we are using small angle linear approximation, for collisions
                                            let closestMob, dist
                                            let range = end - 30 * me.waves[i].resonanceCount
                                            for (let i = 0, len = mob.length; i < len; i++) {
                                                if (who !== mob[i] && !mob[i].isBadTarget && !mob[i].isInvulnerable) {
                                                    dist = Vector.magnitude(Vector.sub(who.position, mob[i].position));
                                                    if (dist < range) {
                                                        closestMob = mob[i]
                                                        range = dist
                                                    }
                                                }
                                            }
                                            if (closestMob) {
                                                const dir = Vector.normalise(Vector.sub(closestMob.position, who.position))
                                                var angle3 = Math.atan2(dir.y, dir.x)
                                            } else {
                                                var angle3 = 2 * Math.PI * Math.random()
                                            }
                                            me.waves.push({
                                                position: who.position,
                                                angle: angle3 - halfArc, //used in drawing ctx.arc
                                                unit1: { x: Math.cos(angle3 - halfArc), y: Math.sin(angle3 - halfArc) }, //used for collision
                                                unit2: { x: Math.cos(angle3 + halfArc), y: Math.sin(angle3 + halfArc) }, //used for collision
                                                arc: halfArc * 2,
                                                radius: 25,
                                                resonanceCount: me.waves[i].resonanceCount + 1
                                            })
                                        }
                                    }
                                }

                                hits = Matter.Query.ray(body, v1, v2, 50) //Matter.Query.ray(bodies, startPoint, endPoint, [rayWidth])
                                for (let j = 0, len = Math.min(30, hits.length); j < len; j++) {
                                    const who = hits[j].body
                                    //make them shake around
                                    who.force.x += 0.01 * (Math.random() - 0.5) * who.mass
                                    who.force.y += (0.01 * (Math.random() - 0.5) - simulation.g * 0.25) * who.mass //remove force of gravity
                                    let vertices = who.vertices;
                                    const vibe = 25
                                    ctx.moveTo(vertices[0].x + vibe * (Math.random() - 0.5), vertices[0].y + vibe * (Math.random() - 0.5));
                                    for (let j = 1; j < vertices.length; j++) {
                                        ctx.lineTo(vertices[j].x + vibe * (Math.random() - 0.5), vertices[j].y + vibe * (Math.random() - 0.5));
                                    }
                                    ctx.lineTo(vertices[0].x + vibe * (Math.random() - 0.5), vertices[0].y + vibe * (Math.random() - 0.5));

                                    if (me.tech.isPhononBlock && !who.isNotHoldable && who.speed < 5 && who.angularSpeed < 0.1) {
                                        if (Math.random() < 0.5) b.targetedBlock(who, 50 - Math.min(25, who.mass * 3)) //    targetedBlock(who, speed = 50 - Math.min(20, who.mass * 2), range = 1600) {
                                        // Matter.Body.setAngularVelocity(who, (0.25 + 0.12 * Math.random()) * (Math.random() < 0.5 ? -1 : 1));
                                        who.torque += who.inertia * 0.001 * (Math.random() - 0.5)
                                    }
                                }

                                me.waves[i].radius += me.tech.waveBeamSpeed * 1.8 //expand / move
                                if (me.waves[i].radius > end - 30 * me.waves[i].resonanceCount) {
                                    me.waves.splice(i, 1) //end
                                }
                            }
                            ctx.stroke();
                        }
                    }
                }
                if (this.charge > 0 && me.tech.isFoamPressure) {
                    //draw charge level
                    ctx.fillStyle = "rgba(0,50,50,0.3)";
                    ctx.beginPath();
                    const radius = 5 * Math.sqrt(this.charge)
                    const mag = 11 + radius
                    ctx.arc(me.pos.x + mag * Math.cos(me.angle2), me.pos.y + mag * Math.sin(me.angle2), radius, 0, 2 * Math.PI);
                    ctx.fill();

                    if (this.isDischarge && me.cycle % 2 && !me.isTimeDilated) {
                        const spread = (me.crouch ? 0.04 : 0.5) * (Math.random() - 0.5)
                        const radius = 5 + 8 * Math.random() + (me.tech.isAmmoFoamSize && this.ammo < 300) * 12
                        const SPEED = (me.crouch ? 1.2 : 1) * 10 - radius * 0.4 + Math.min(5, Math.sqrt(this.charge));
                        const dir = me.angle2 + 0.15 * (Math.random() - 0.5)
                        const velocity = {
                            x: 0.7 * me.velocity.x + SPEED * Math.cos(dir),
                            y: 0.5 * me.velocity.y + SPEED * Math.sin(dir)
                        }
                        const position = {
                            x: me.pos.x + 30 * Math.cos(me.angle2),
                            y: me.pos.y + 30 * Math.sin(me.angle2)
                        }
                        b2.foam(position, Vector.rotate(velocity, spread), radius, id)
                        me.applyKnock(velocity)
                        this.charge -= 0.75
                        me.fireCDcycle = me.cycle + 2; //disable firing and adding more charge until empty
                    } else if (!input.fire) {
                        this.isDischarge = true;
                    }
                } else if(me.tech.isFoamPressure) {
                    if (this.isDischarge) {
                        me.fireCDcycle = me.cycle + Math.floor(25 * me.fireCDscale);
                    }
                    this.isDischarge = false
                } 
                if (me.charge > 0 && me.tech.isPulseLaser) {
                    //draw charge level
                    ctx.beginPath();
                    ctx.arc(me.pos.x, me.pos.y, 4.2 * Math.sqrt(me.charge), 0, 2 * Math.PI);
                    // ctx.fillStyle = `rgba(255,0,0,${0.09 * Math.sqrt(me.charge)})`;
                    ctx.fillStyle = `rgba(255,0,0,${0.09 * Math.sqrt(me.charge)})`;
                    ctx.fill();
                    //fire  
                    if (!me.inputFire) {
                        if (me.charge > 5) {
                            me.fireCDcycle = me.cycle + Math.floor(35 * me.fireCDscale); // cool down
                            if (me.tech.beamSplitter) {
                                const divergence = me.crouch ? 0.15 : 0.35
                                const angle = me.angle2 - me.tech.beamSplitter * divergence / 2
                                for (let i = 0; i < 1 + me.tech.beamSplitter; i++) b2.pulse(me.charge, angle + i * divergence, me.pos, me.id)
                            } else {
                                b2.pulse(1.8 * me.charge * me.lensDamage, me.angle2, me.pos, me.id)
                            }
                        }
                        me.charge = 0;
                    }
                }
                if (this.charge > 0 && me.tech.isRailGun) {
                    const DRAIN = (me.tech.isRailEnergy ? 0 : 0.002)
                    if (me.energy < DRAIN) {
                        me.fireCDcycle = me.cycle + 120;
                        this.endCycle = 0;
                        this.charge = 0
                        return
                    }
                    //fire
                    if ((!me.inputFire && this.charge > 0.6)) {
                        const where = {
                            x: me.pos.x + 30 * Math.cos(me.angle2),
                            y: me.pos.y + 30 * Math.sin(me.angle2)
                        }
                        const closest = {
                            distance: 10000,
                            target: null
                        }
                        //push away blocks and mobs
                        const range = 600 + 500 * this.charge
                        for (let i = 0, len = mob.length; i < len; ++i) { //push away mobs when firing
                            if (!mob[i].isUnblockable && mob[i].id != me.id) {
                                const SUB = Vector.sub(mob[i].position, me.pos)
                                const DISTANCE = Vector.magnitude(SUB)
                                if (DISTANCE < range + mob[i].radius) {
                                    const DEPTH = 100 + Math.min(range - DISTANCE + mob[i].radius, 1500)
                                    const FORCE = Vector.mult(Vector.normalise(SUB), 0.0015 * Math.sqrt(DEPTH) * mob[i].mass)
                                    mob[i].force.x += FORCE.x;
                                    mob[i].force.y += FORCE.y;

                                    let dmg = (mob[i].isDropPowerUp ? 350 : 1100) * me.tech.harpoonDensity * this.charge
                                    simulation.drawList.push({ //add dmg to draw queue
                                        x: mob[i].position.x,
                                        y: mob[i].position.y,
                                        radius: Math.log(dmg + 1.1) * 40 * mob[i].damageReduction + 3,
                                        color: 'rgba(100, 0, 200, 0.4)',
                                        time: 15
                                    });
                                    mob[i].damage(dmg);
                                }
                            }
                        }
                        for (let i = 0, len = body.length; i < len; ++i) { //push away blocks when firing
                            const SUB = Vector.sub(body[i].position, me.pos)
                            const DISTANCE = Vector.magnitude(SUB)
                            if (DISTANCE < range) {
                                const DEPTH = Math.min(range - DISTANCE, 500)
                                const FORCE = Vector.mult(Vector.normalise(SUB), 0.003 * Math.sqrt(DEPTH) * body[i].mass)
                                body[i].force.x += FORCE.x;
                                body[i].force.y += FORCE.y - body[i].mass * simulation.g * 1.5; //kick up a bit to give them some arc
                            }
                        }
                        for (let i = 0, len = powerUp.length; i < len; ++i) { //push away blocks when firing
                            const SUB = Vector.sub(powerUp[i].position, me.pos)
                            const DISTANCE = Vector.magnitude(SUB)
                            if (DISTANCE < range) {
                                const DEPTH = Math.min(range - DISTANCE, 500)
                                const FORCE = Vector.mult(Vector.normalise(SUB), 0.002 * Math.sqrt(DEPTH) * powerUp[i].mass)
                                powerUp[i].force.x += FORCE.x;
                                powerUp[i].force.y += FORCE.y - powerUp[i].mass * simulation.g * 1.5; //kick up a bit to give them some arc
                            }
                        }
                        //draw little dots near the edge of range
                        for (let i = 0, len = 10 + 25 * this.charge; i < len; i++) {
                            const unit = Vector.rotate({ x: 1, y: 0 }, 6.28 * Math.random())
                            const where = Vector.add(me.pos, Vector.mult(unit, range * (0.6 + 0.3 * Math.random())))
                            simulation.drawList.push({
                                x: where.x,
                                y: where.y,
                                radius: 5 + 12 * Math.random(),
                                color: "rgba(100, 0, 200, 0.1)",
                                time: Math.floor(5 + 35 * Math.random())
                            });
                        }

                        const recoil = Vector.mult(Vector.normalise(Vector.sub(where, me.pos)), me.crouch ? 0.03 : 0.06)
                        me.force.x -= recoil.x
                        me.force.y -= recoil.y
                        const harpoonSize = me.tech.isLargeHarpoon ? 1 + 0.07 * Math.sqrt(this.ammo) : 1
                        const thrust = 0.15 * (this.charge)
                        if (me.tech.extraHarpoons) {
                            let targetCount = 0
                            const SPREAD = 0.06 + 0.05 * (!me.crouch)
                            let angle = me.angle2 - SPREAD * me.tech.extraHarpoons / 2;
                            const dir = {
                                x: Math.cos(angle),
                                y: Math.sin(angle)
                            }; //make a vector for the player's direction of length 1; used in dot product

                            for (let i = 0, len = mob.length; i < len; ++i) {
                                if (mob[i].alive && !mob[i].isBadTarget && !mob[i].shield && Matter.Query.ray(map, me.pos, mob[i].position).length === 0 && !mob[i].isInvulnerable) {
                                    const dot = Vector.dot(dir, Vector.normalise(Vector.sub(mob[i].position, me.pos))) //the dot product of diff and dir will return how much over lap between the vectors
                                    const dist = Vector.magnitude(Vector.sub(where, mob[i].position))
                                    if (dot > 0.95 - Math.min(dist * 0.00015, 0.3)) { //lower dot product threshold for targeting then if you only have one harpoon //target closest mob that player is looking at and isn't too close to target
                                        // if (this.ammo > -1) {
                                        //     this.ammo--
                                        b2.harpoon(where, me.crouch ? null : mob[i], angle, harpoonSize, false, 35, false, thrust, me.id) //harpoon(where, target, angle = me.angle2, harpoonSize = 1, isReturn = false, totalCycles = 35, isReturnAmmo = true, thrust = 0.1) {
                                        angle += SPREAD
                                        targetCount++
                                        if (targetCount > me.tech.extraHarpoons) break
                                        // }
                                    }
                                }
                            }
                            //if more harpoons and no targets left
                            if (targetCount < me.tech.extraHarpoons + 1) {
                                const num = me.tech.extraHarpoons + 1 - targetCount
                                for (let i = 0; i < num; i++) {
                                    b2.harpoon(where, null, angle, harpoonSize, false, 35, false, thrust, me.id)
                                    angle += SPREAD
                                }
                            }
                            simulation.updateGunHUD();
                        } else {
                            //look for closest mob in player's LoS
                            const dir = {
                                x: Math.cos(me.angle2),
                                y: Math.sin(me.angle2)
                            }; //make a vector for the player's direction of length 1; used in dot product
                            for (let i = 0, len = mob.length; i < len; ++i) {
                                if (mob[i].alive && !mob[i].isBadTarget && Matter.Query.ray(map, me.pos, mob[i].position).length === 0 && !mob[i].isInvulnerable) {
                                    const dot = Vector.dot(dir, Vector.normalise(Vector.sub(mob[i].position, me.pos))) //the dot product of diff and dir will return how much over lap between the vectors
                                    const dist = Vector.magnitude(Vector.sub(where, mob[i].position))
                                    if (dist < closest.distance && dot > 0.98 - Math.min(dist * 0.00014, 0.3)) { //target closest mob that player is looking at and isn't too close to target
                                        closest.distance = dist
                                        closest.target = mob[i]
                                    }
                                }
                            }
                            b2.harpoon(where, closest.target, me.angle2, harpoonSize, false, 35, false, thrust, me.id)
                        }

                        this.charge = 0;
                    } else { //charging
                        if (me.tech.isFireMoveLock) {
                            Matter.Body.setVelocity(player, {
                                x: 0,
                                y: -55 * me.mass * simulation.g //undo gravity before it is added
                            });
                            me.force.x = 0
                            me.force.y = 0
                        }
                        me.fireCDcycle = me.cycle + 10 //can't fire until mouse is released
                        // const previousCharge = this.charge

                        //small me.fireCDscale = faster shots, me.fireCDscale=1 = normal shot,  big me.fireCDscale = slower chot
                        // let smoothRate = me.tech.isCapacitor ? 0.85 : Math.min(0.998, 0.985 * (0.98 + 0.02 * me.fireCDscale))
                        const rate = Math.sqrt(me.fireCDscale) * me.tech.railChargeRate * (me.tech.isCapacitor ? 0.6 : 1) * (me.crouch ? 0.8 : 1)
                        let smoothRate = Math.min(0.998, 0.94 + 0.05 * rate)


                        this.charge = 1 - smoothRate + this.charge * smoothRate
                        if (me.energy > DRAIN) me.energy -= DRAIN

                        //draw magnetic field
                        const X = me.pos.x
                        const Y = me.pos.y
                        const unitVector = {
                            x: Math.cos(me.angle2),
                            y: Math.sin(me.angle2)
                        }
                        const unitVectorPerp = Vector.perp(unitVector)

                        function magField(mag, arc) {
                            ctx.moveTo(X, Y);
                            ctx.bezierCurveTo(
                                X + unitVector.x * mag, Y + unitVector.y * mag,
                                X + unitVector.x * mag + unitVectorPerp.x * arc, Y + unitVector.y * mag + unitVectorPerp.y * arc,
                                X + unitVectorPerp.x * arc, Y + unitVectorPerp.y * arc)
                            ctx.bezierCurveTo(
                                X - unitVector.x * mag + unitVectorPerp.x * arc, Y - unitVector.y * mag + unitVectorPerp.y * arc,
                                X - unitVector.x * mag, Y - unitVector.y * mag,
                                X, Y)
                        }
                        ctx.fillStyle = `rgba(50,0,100,0.05)`;
                        const magSize = 8 * this.charge * me.tech.railChargeRate ** 3
                        const arcSize = 6 * this.charge * me.tech.railChargeRate ** 3
                        for (let i = 3; i < 7; i++) {
                            const MAG = magSize * i * i * (0.93 + 0.07 * Math.random())
                            const ARC = arcSize * i * i * (0.93 + 0.07 * Math.random())
                            ctx.beginPath();
                            magField(MAG, ARC)
                            magField(MAG, -ARC)
                            ctx.fill();
                        }
                    }
                }
                me.grenadeDo.do();
                me.setGrenadeMode();
			};
            me.remotePlayer = true;
            me.onDamage = function(dmg) {
                sendDamage(dmg, me.id);
            }
            me.onDeath = function() {
                delete remotePlayers[me.id];
            }
			me.leaveBody = false;
			return me;
		}
        window.rpp = function() {
            for (let id in remotePlayers) {
                if (remotePlayers[id].isTimeDilated) {
                    return true;
                }
            }
            return false;
        }
        Matter.Events.on(engine, "afterUpdate", () => {
            let shouldFreeze = !m.isTimeDilated && rpp();
            if (shouldFreeze) {
                if (!player._frozenPos) {
                    player._frozenPos = { x: player.position.x, y: player.position.y };
                }
                Matter.Body.setPosition(player, player._frozenPos);
                Matter.Body.setVelocity(player, { x: 0, y: 0 });
                Matter.Body.setAngularVelocity(player, 0);
                player.force.x = 0; player.force.y = 0;
                player.torque = 0;
            } else {
                if (player._frozenPos) {
                    delete player._frozenPos;
                    delete player._frozenAngle;
                }
            }
        });

        const chatStyle = document.createElement("style");
        chatStyle.textContent = `
        #chat-input {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: min(70vw, 800px);
            z-index: 9999;
            width: -webkit-fill-available;
            padding: 10px 12px;
            font-size: 16px;
            line-height: 1.4;
            color: #000;
            background: #e8e8e8cf;
            border: 0;
        }
        #chat-input::placeholder { color: #aaa; }
        `;
        document.head.appendChild(chatStyle);
        const overlay = document.createElement("div");
        overlay.style.display = "none";
        overlay.innerHTML = `<input id="chat-input" type="text" maxlength="420" placeholder="">`;
        document.body.appendChild(overlay);
        const chatInput = overlay.querySelector('#chat-input');
        let chatOpen = false;
        function openChat() {
            chatOpen = true;
            overlay.style.display = 'block';
            chatInput.value = '';
            setTimeout(() => chatInput.focus(), 0);
        }
        function closeChat() {
            chatOpen = false;
            overlay.style.display = 'none';
        }
        function sendChatMessage() {
            const text = (chatInput.value || '').trim();
            if (!text) { closeChat(); return; }
            const name = (window.username || 'unnamed player');
            const message = `${name}: ${text}`;
            sentChat(message);
            if (simulation && typeof simulation.inGameConsole === 'function') {
                simulation.inGameConsole(message);
            }
            closeChat();
        }
        document.addEventListener('keydown', (e) => {
            if (chatOpen) {
                if (e.target !== chatInput) chatInput.focus();
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    sendChatMessage();
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    closeChat();
                    return;
                }
                e.stopPropagation();
                return;
            }
            if (e.key === 'Enter') {
                const t = e.target;
                const isTyping = (
                    t && (
                        (t.tagName === 'INPUT' && t.type && !['button','submit','checkbox','radio','range','color','file'].includes(t.type)) ||
                        t.tagName === 'TEXTAREA' ||
                        t.isContentEditable
                    )
                );
                if (!isTyping) {
                    e.preventDefault();
                    e.stopPropagation();
                    openChat();
                }
            }
        }, true);
    })();
}
