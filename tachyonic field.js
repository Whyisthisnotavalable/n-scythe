javascript:(function() {
	const e = {
		name: "tachyonic field",
		description: `use <b class="color-f">energy</b> to gain a <b>burst</b> of <b>speed</b><br>multiply <b>momentum</b> <b>exponentially</b><br>16 <b class="color-f">energy</b> per second<em style ="float: right; font-family: monospace;font-size:1rem;color:#fff;">←↑↓→↑↓</em>`,
		canMove: false,
		haveEphemera: false,
		keyLog: [null, null, null, null, null, null],
		effect() {
			m.fieldEvent = function (event) {
				m.fieldUpgrades[m.fieldMode].keyLog.shift()
				m.fieldUpgrades[m.fieldMode].keyLog.push(event.code)
				const patternA = ["ArrowLeft", "ArrowUp", "ArrowDown", "ArrowRight", "ArrowUp", "ArrowDown"]
				const patternB = [input.key.left, input.key.up, input.key.down, input.key.right, input.key.up, input.key.down]
				const arraysEqual = (a, b) => a.length === b.length && a.every((val, i) => val === b[i]);
				if (arraysEqual(m.fieldUpgrades[m.fieldMode].keyLog, patternA) || arraysEqual(m.fieldUpgrades[m.fieldMode].keyLog, patternB)) {
					if (!e.haveEphemera && m.energy > 0.1) {
						const triggerEnergy = m.energy;
						const base = m.damageDone ? m.damageDone : m.dmgScale;
						const burstRadius = 1000 * m.energy;
						for (let i = 0; i < mob.length; i++) {
							const dx = mob[i].position.x - player.position.x;
							const dy = mob[i].position.y - player.position.y;
							const d  = Math.hypot(dx, dy);
							if (d < burstRadius && d > 0) {
								const falloff   = 1 - d / burstRadius;
								mob[i].damage(triggerEnergy * base * falloff, true);
								const forceMag = triggerEnergy * 0.8 * falloff;
								Matter.Body.applyForce(mob[i], mob[i].position, {
									x: (dx / d) * forceMag,
									y: (dy / d) * forceMag,
								});
							}
						}
						m.energy *= 0.15;
						const origin = { x: player.position.x, y: player.position.y };
						simulation.ephemera.push({
							name: "zitterbewegung",
							tick: 0,
							maxTick: 25,
							do() {
								this.tick++;
								const progress = this.tick / this.maxTick;
								const fade     = 1 - progress;
								for (let r = 0; r < 3; r++) {
									const ringRadius = progress * burstRadius + r * 28;
									this.drawRing(origin, ringRadius, fade * (1 - r * 0.25), triggerEnergy);
								}
								if (this.tick >= this.maxTick) simulation.removeEphemera(this.name, true);
							},
							drawRing(where, radius, alpha, energy) {
								const numPoints = 14;
								const slice     = (2 * Math.PI) / numPoints;
								ctx.save();
								ctx.beginPath();
								ctx.lineWidth   = 4 + energy * 4;
								ctx.lineJoin    = "miter";
								ctx.miterLimit  = 100;
								ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.9})`;
								ctx.shadowColor = "rgba(220,20,60,0.9)";
								ctx.shadowBlur  = 12 * alpha;
								for (let i = 0; i <= numPoints; i++) {
									const angle  = i * slice;
									const jitter = radius * 0.2;
									ctx.lineTo(
										where.x + Math.cos(angle) * radius + (Math.random() - 0.5) * jitter,
										where.y + Math.sin(angle) * radius + (Math.random() - 0.5) * jitter
									);
								}
								ctx.closePath();
								ctx.stroke();
								ctx.restore();
							}
						});
					}
				}
			}
			window.addEventListener("keydown", m.fieldEvent);

			m.fieldMeterColor = "#D12";
			m.eyeFillColor = m.fieldMeterColor;
			m.fillColor = m.fieldMeterColor;
			m.fieldRegen = 0.002667;
			m.energy += m.fieldRegen;
			m.color = {
				hue: 0,
				sat: 5,
				light: 100,
			}
			m.couplingDescription = (couple = m.coupling) => {
				switch (m.fieldMode) {
					case 0: return `<strong>all</strong> effects`
					case 1: return `+${(couple * 5).toFixed(0)} maximum <strong class='color-f'>energy</strong>`
					case 2: return `<span style = 'font-size:95%;'><strong>deflecting</strong> condenses ${(0.1 * couple).toFixed(2)} <strong class='color-s'>ice IX</strong></span>`
					case 3: return `<strong>${(0.973 ** couple).toFixed(2)}x</strong> <strong class='color-defense'>damage taken</strong>`
					case 4: return `<strong>+${(0.6 * couple).toFixed(1)}</strong> <strong class='color-f'>energy</strong> per second`
					case 5: return `<strong>${(1 + 0.015 * couple).toFixed(3)}x</strong> <strong class='color-d'>damage</strong>`
					case 6: return `<strong>+${(1 + 0.05 * couple).toFixed(2)}x</strong> longer <strong style='letter-spacing: 2px;'>stopped time</strong>`
					case 7: return `<strong>${(1 + 0.05 * couple).toFixed(3)}x</strong> ambush <strong class='color-d'>damage</strong>`
					case 8: return `<strong>${(1 + 0.05 * couple).toFixed(2)}x</strong> <strong class='color-block'>block</strong> collision <strong class='color-d'>damage</strong>`
					case 9: return `<span style = 'font-size:89%;'>after eating <strong class='color-block'>blocks</strong> <strong>+${(2 * couple).toFixed(0)}</strong> <strong class='color-f'>energy</strong></span>`
					case 10: return `<span style="opacity: 1;">${powerUps.orb.ammo(1)}</span> give ${(4 * couple).toFixed(0)}% more ammo`
				}
				if(m.fieldMeterColor = "#D12") {
					return `<strong>${(1 + Math.abs(Math.log(couple)) / 5).toFixed(2)}x</strong> movement <em class="color-s">speed</em>`
				}
			}
			m.setFillColors();
			m.hold = () => {
				m.fieldFx = 1 + Math.abs(Math.log(m.coupling + 1)) / 5;
				m.setMovement();
				const dist = Vector.sub(simulation.mouseInGame, player.position);
				const distMag = Vector.magnitude(dist);
				const radius = 400;
				if (distMag < radius || m.isHolding) {
					m.canMove = false;
				} else {
					m.canMove = true;
				}
				ctx.beginPath();
				ctx.moveTo(player.position.x + radius, player.position.y);
				ctx.lineWidth = 2;
				ctx.arc(player.position.x, player.position.y, radius, 0, 2 * Math.PI);
				ctx.strokeStyle = "#909090";
				ctx.fillStyle = !m.canMove ? "rgba(220, 20, 60, 0.05)" : "transparent";
				ctx.stroke();
				ctx.fill();
				ctx.beginPath();
				ctx.fillStyle = !m.canMove ? "rgba(220, 20, 60, 0.02)" : "transparent";
				ctx.moveTo(player.position.x, player.position.y - radius);
				ctx.lineTo(player.position.x + radius, player.position.y);
				ctx.lineTo(player.position.x, player.position.y + radius);
				ctx.lineTo(player.position.x - radius, player.position.y);
				ctx.closePath();
				ctx.fill();
				ctx.beginPath();
				ctx.strokeStyle = !m.canMove ? "rgba(220, 20, 60, 0.06)" : "transparent";
				ctx.lineWidth = 75;
				ctx.moveTo(player.position.x, player.position.y - 200);
				ctx.lineTo(player.position.x, player.position.y + 100);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(player.position.x + 5, player.position.y + 200);
				ctx.arc(player.position.x, player.position.y + 200, 5, 0, 2 * Math.PI);
				ctx.stroke();

				if (tech.tachCondensation) {
					for (let i = 0; i < mob.length; i++) {
						if (Matter.Query.collides(player, [mob[i]]).length > 0) {
							const dmg = Math.sqrt((m.damageDone ? m.damageDone : m.dmgScale) * Math.sqrt(player.speed));
							mob[i].damage(dmg, true);
							simulation.drawList.push({
								x: mob[i].position.x,
								y: mob[i].position.y,
								radius: Math.abs(Math.log(dmg * player.speed) * 40 * mob[i].damageReduction + 3),
								color: simulation.mobDmgColor,
								time: simulation.drawTime
							});
							break;
						}
					}
				}
				const fieldRef = e;
				if (input.field && m.fieldCDcycle < m.cycle && m.canMove && m.energy > 0.2 && (player.velocity.x || player.velocity.y) && !e.haveEphemera) {
					e.haveEphemera = true;
					simulation.ephemera.push({
						name: "speedBoost",
						oldPosition: { x: player.position.x, y: player.position.y },
						drain: 0.008,
						fading: false,
						fadeAlpha: 1.0,
						wakeHits: new Map(),
						do() {
							if (this.fading) {
								this.fadeAlpha *= 0.75;
								if (this.trail && this.trail.length > 0) this.trail.shift();
								if (this.trail && this.trail.length > 1) {
									this.drawLightningTrail(this.trail, this.fadeAlpha);
									this.checkWakefield(this.trail, this.fadeAlpha);
								}
								if (!this.trail || this.trail.length <= 1 || this.fadeAlpha < 0.04) {
									simulation.removeEphemera(this.name, true);
								}
								return;
							}
							if (m.energy > 0.1 && input.field && m.canMove) {
								if(tech.relativisticPenetration) player.collisionFilter.mask = cat.body | cat.map | cat.mobBullet | cat.mobShield;
								const maxSpeed = 500;
								const curSpeed = Math.hypot(player.velocity.x, player.velocity.y);
								if (curSpeed < maxSpeed) {
									const factor = 1 + 0.08 * Math.max(0, (maxSpeed - curSpeed) / maxSpeed);
									Matter.Body.setVelocity(player, {
										x: player.velocity.x * factor * (m.onGround ? 1.1 : 1),
										y: player.velocity.y * factor,
									});
								}
								m.energy -= this.drain;
								if (!this.trail) this.trail = [];
								this.trail.push({ x: m.pos.x + Math.cos(m.angle) * 15, y: m.pos.y + Math.sin(m.angle) * 15 });
								if (this.trail.length > 14) this.trail.shift();
								this.drawLightningArc(m.pos, 50);
								this.drawLightningTrail(this.trail, 1.0);
								this.checkWakefield(this.trail, 1.0);
								if (!(simulation.cycle % 100)) {
									this.oldPosition = { x: (m.pos.x + this.oldPosition.x) / 2, y: (m.pos.y + this.oldPosition.y) / 2 };
								}
							} else {
								fieldRef.haveEphemera = false;
								this.fading = true;
								this.fadeAlpha = 1.0;
								if(tech.relativisticPenetration) player.collisionFilter.mask = cat.body | cat.map | cat.mob | cat.mobBullet | cat.mobShield;

							}
						},
						checkWakefield(trail, alphaMultiplier = 1) {
							if (!tech.wakeField || !trail || trail.length < 2) return;
							const r = 50;
							const cd = 40;
							const base = m.damageDone ? m.damageDone : m.dmgScale;
							const dmg = trail.length * base * 0.3 * alphaMultiplier;
							if (dmg <= 0.01) return;
							for (let mi = 0; mi < mob.length; mi++) {
								const lastHit = this.wakeHits.get(mob[mi]) || 0;
								if (simulation.cycle - lastHit < cd) continue;
								for (let ti = 0; ti < trail.length; ti++) {
									const d = Math.hypot(
										mob[mi].position.x - trail[ti].x,
										mob[mi].position.y - trail[ti].y
									);
									if (d < r) {
										mob[mi].damage(dmg, true);
										this.wakeHits.set(mob[mi], simulation.cycle);
										simulation.drawList.push({
											x: trail[ti].x,
											y: trail[ti].y,
											radius: 8 + trail.length * 10,
											color: "rgba(220,20,60,0.5)",
											time: 12
										});
									}
								}
							}
						},
						drawLightningArc(where, radius, lineWidth = 10, isCoolColors = true, strokeColor = null, shadowColor = null, shadowBlur = null) {
							const numPoints = 16;
							const slice = (2 * Math.PI) / numPoints;
							ctx.save();
							ctx.beginPath();
							ctx.lineWidth = lineWidth;
							ctx.lineJoin = "miter";
							ctx.miterLimit = 100;
							if (isCoolColors) {
								ctx.strokeStyle = "white";
								ctx.shadowColor = "rgba(220, 20, 60, 0.9)";
								ctx.shadowBlur = 5;
							} else {
								ctx.strokeStyle = strokeColor;
								ctx.shadowColor = shadowColor;
								ctx.shadowBlur = shadowBlur;
							}
							for (let i = 0; i < numPoints; i++) {
								const angle = i * slice;
								const dx = Math.cos(angle) * radius * 0.8;
								const dy = Math.sin(angle) * radius * 0.8;
								const newX = where.x + dx + Math.random() * radius * 0.4 - radius * 0.2;
								const newY = where.y + dy + Math.random() * radius * 0.4 - radius * 0.2;
								ctx.lineTo(newX, newY);
							}
							ctx.closePath();
							ctx.stroke();
							ctx.restore();
						},
						drawLightningTrail(trail, alphaMultiplier = 1) {
							if (!trail || trail.length < 2) return;
							ctx.save();
							ctx.lineJoin = "miter";
							ctx.miterLimit = 100;
							for (let i = 1; i < trail.length; i++) {
								const t = i / (trail.length - 1);
								const alpha = t * 0.9 * alphaMultiplier;
								const lineWidth = 1 + t * 7;
								const x1 = trail[i - 1].x, y1 = trail[i - 1].y;
								const x2 = trail[i].x,     y2 = trail[i].y;
								const dx = x2 - x1,        dy = y2 - y1;
								const dist = Math.hypot(dx, dy);
								if (dist < 1) continue;
								const segments = Math.max(2, Math.ceil(dist / 12));
								const jitter = Math.min(dist * 0.35, 18);
								ctx.lineWidth = lineWidth;
								ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
								ctx.shadowColor = "rgba(220,20,60,0.9)";
								ctx.shadowBlur = 8 * t * alphaMultiplier;
								ctx.beginPath();
								ctx.moveTo(x1, y1);
								for (let s = 1; s < segments; s++) {
									const frac = s / segments;
									ctx.lineTo(
										x1 + dx * frac + (Math.random() - 0.5) * jitter,
										y1 + dy * frac + (Math.random() - 0.5) * jitter
									);
								}
								ctx.lineTo(x2, y2);
								ctx.stroke();
							}
							ctx.restore();
						}
					});
				}
				
				if (m.isHolding) {
				    m.drawHold(m.holdingTarget);
				    m.holding();
				    m.throwBlock();
				} else if ((input.field && m.fieldCDcycle < m.cycle)) {
				    if (m.energy > m.fieldRegen) m.energy -= m.fieldRegen;
				    m.grabPowerUp();
				    if (typeof m.lookForPickUp == 'function') {
					    m.lookForPickUp(); 
				    } else {
					    m.lookForBlock();
				    }
				} else if (m.holdingTarget && m.fieldCDcycle < m.cycle) {
				    m.pickUp();
				} else {
				    m.holdingTarget = null;
				}
				m.drawRegenEnergy();
			}
		},
	}
	m.fieldUpgrades.push(e);
	const fieldArray = m.fieldUpgrades.filter(
		(obj, index, self) =>
			index === self.findIndex((item) => item.name === obj.name)
	);
	m.fieldUpgrades = fieldArray;
	const t = [
		{
			name: "tachyon condensation",
			descriptionFunction() {
				return `after <b>colliding</b> with mobs<br>deal <b class="color-d">damage</b> based on <b class="color-speed">speed</b>`
			},
			isFieldTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() { return m.fieldMeterColor == "#D12" && !tech.relativisticPenetration },
			requires: "tachyonic field, not relativistic penetration",
			effect()  { tech.tachCondensation = true; },
			remove()  { tech.tachCondensation = false; }
		},		
		{
			name: "relativistic penetration",
			descriptionFunction() {
				return `phase through <b>mobs</b> when <b>tachyonic field</b> is active`
			},
			isFieldTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() { return m.fieldMeterColor == "#D12" && !tech.tachCondensation },
			requires: "tachyonic field, not tachyon condensation",
			effect()  { tech.relativisticPenetration = true; },
			remove()  { tech.relativisticPenetration = false; }
		},

		{
			name: "wakefield",
			descriptionFunction() {
				return `<b>trail</b> damages mobs on contact<br><b class="color-d">damage</b> scales with trail <b class="color-speed">length</b>`
			},
			isFieldTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() { return m.fieldMeterColor == "#D12" && tech.relativisticPenetration },
			requires: "tachyonic field, relativistic penetration",
			effect()  { tech.wakeField = true; },
			remove()  { tech.wakeField = false; }
		},
	];
	t.reverse();
	for (let i = 0; i < tech.tech.length; i++) {
		if (tech.tech[i].name === 'Newtons 1st law' || tech.tech[i].name === 'Newtons 2nd law') {
			tech.tech[i].requires = "negative mass, grappling hook, tachyonic field"
			tech.tech[i].allowed = () => {
				return m.fieldMode === 3 || m.fieldMode === 10 || m.fieldMeterColor == "#D12";
			}
		}
		if (tech.tech[i].name === 'reel') {
			for (let j = 0; j < t.length; j++) {
				tech.tech.splice(i + 1, 0, t[j]);
			}
			break;
		}
	}
	const techArray = tech.tech.filter(
		(obj, index, self) =>
			index === self.findIndex((item) => item.name === obj.name)
	);
	tech.tech = techArray;
})();
