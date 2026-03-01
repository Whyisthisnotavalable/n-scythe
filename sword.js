javascript:(function() {
	const e = {
		name: "sword",
		descriptionFunction() { return `swing a <b>sword</b> that <b style="color: indigo;">lifesteals</b> <strong class='color-h'>health</strong><br>drains <strong class='color-h'>health</strong> instead of ammunition<br>doesn't use <b>ammo</b>`},
		ammo: Infinity,
		ammoPack: Infinity,
		defaultAmmoPack: Infinity,
		have: false,
		cycle: 0,
		sword: undefined,
		swordArray: [],
		bladeSegments: undefined,
		bladeTrails: [],
		angle: 0,
		constraint: undefined,
		charge: 0,
		angle2: 0,
		released: false,
		stabStatus: false,
		haveEphemera: false,
		isBroken: false,
		brokenParts: [],
		isReforming: false,
		isSlowed: false,
		technique: { 
			active: false, 
			phase: "idle", // idle, slowmo, input, resolve 
			timer: 0, 
			target: null, 
			pattern: [], 
			progress: 0, 
			lastKill: 0,
		},
		keyLog: [null, null, null, null],
		keyLogCycle: [0, 0, 0, 0],
		comboWindow: 35,
		listen: true,
		shouldSlow: false,
		fire() { },
		do() {
			if(tech.hartmanEffect) this.updateTechnique();
			if(this.listen) {
				window.addEventListener("keydown", this.keyListener.bind(this));
				this.listen = false;
			}
			if(!this.haveEphemera) {
				this.haveEphemera = true;
				simulation.ephemera.push({
					name: "sword",
					do() {
						if(b.guns[b.activeGun].name !== 'sword') {
							for (let i = 0, len = b.inventory.length; i < len; ++i) {
								if(b.guns[b.inventory[i]].name === "sword" && b.guns[b.inventory[i]].sword) {
									b.guns[b.inventory[i]].cycle = 0;
									if(b.guns[b.inventory[i]].constraint1) {
										Composite.remove(engine.world, b.guns[b.inventory[i]].constraint1);
										b.guns[b.inventory[i]].constraint1 = undefined;
									}
									if(b.guns[b.inventory[i]].constraint2) {
										Composite.remove(engine.world, b.guns[b.inventory[i]].constraint2);
										b.guns[b.inventory[i]].constraint2 = undefined;
									}
									Composite.remove(engine.world, b.guns[b.inventory[i]].sword);
									b.guns[b.inventory[i]].sword.parts.forEach(part => {
										Composite.remove(engine.world, part);
										const index = bullet.indexOf(part);
										if (index !== -1) {
											bullet.splice(index, 1);
										}
									});
									b.guns[b.inventory[i]].sword = undefined;
									b.guns[b.inventory[i]].bladeTrails = [];
								}
							}
						}
						if(b.guns[b.activeGun].name == 'sword' && tech.greatSword && b.guns[b.activeGun].sword) {
							let bladeSegments = b.guns[b.activeGun].bladeSegments;
							for(let i = 0; i < bladeSegments.length; i++) {
								if(!bladeSegments[i].render) continue;
								ctx.beginPath();
								ctx.lineJoin = "miter";
								ctx.miterLimit = 100;
								ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : "crimson";
								ctx.lineWidth = 5;
								ctx.fillStyle = "black";
								ctx.moveTo(bladeSegments[i].vertices[0].x, bladeSegments[i].vertices[0].y);
								for(let j = 0; j < bladeSegments[i].vertices.length; j++) {
									ctx.lineTo(bladeSegments[i].vertices[j].x, bladeSegments[i].vertices[j].y)
								};
								ctx.closePath();
								ctx.stroke();
								ctx.fill();
								ctx.lineJoin = "round";
								ctx.miterLimit = 10;
							}
						}
					}
				})
			}
			if(this.sword && this.cycle < 1) {
				this.angle2 = Math.atan2(this.sword.position.y - m.pos.y, this.sword.position.x - m.pos.x);
			}
			if(this.sword) {
				this.cycle++;
			}
			this.chooseFireMethod();
			this.fire();
			if(tech.soundSword) {
				this.renderSoundSword();
			} else if(tech.longSword) {
				this.renderLongsword();
			} else {
				this.renderDefault();
			}
			this.blades();
			this.collision();
			if (this.technique.cutLine) {
				const c = this.technique.cutLine;
				ctx.globalCompositeOperation = "exclusion"
				ctx.fillStyle = `rgba(255,255,255,${c.alpha})`;
				ctx.fillRect(-50000, -50000, 100000, 100000)
				ctx.globalCompositeOperation = "source-over"

				ctx.beginPath();
				ctx.moveTo(c.x1, c.y1);
				ctx.lineTo(c.x2, c.y2);
				ctx.strokeStyle = `rgba(200,0,0,${c.alpha})`;
				ctx.lineWidth = 25;
				ctx.stroke();
				ctx.strokeStyle = `rgba(255,0,0,${c.alpha})`;
				ctx.lineWidth = 20;
				ctx.stroke();
				ctx.strokeStyle = `rgba(255,255,255,${c.alpha})`;
				ctx.lineWidth = 15;
				ctx.stroke();
				c.alpha -= 0.03;
				if (c.alpha <= 0) {
					this.technique.cutLine = null;
				}
			}
		},
		chooseFireMethod() {
			if (tech.isStabSword && m.crouch && input.down) {
				this.fire = this.stabFire
			} else {
				this.fire = this.normalFire
			}
		},
		stabFire() {
			if(this.constraint) {
				this.constraint.pointA = player.position;
			}
			if(this.sword) {
				this.stabStatus = true;
				if(tech.isEnergyHealth) {
					m.energy -= 0.002;
				} else {
					m.health -= 0.00025;
					m.displayHealth();
				}
			}
			if (input.fire && (tech.isEnergyHealth ? m.energy >= 0.11 : m.health >= 0.11)) {
				if (!this.sword && b.guns[b.activeGun].name === 'sword') {
					if(tech.greatSword) {
						({ sword: this.sword, bladeSegments: this.bladeSegments} = this.greatSword());
					} else if(tech.longSword) {
						({ sword: this.sword, bladeSegments: this.bladeSegments} = this.longSword());
					} else {
						({ sword: this.sword, bladeSegments: this.bladeSegments} = this.createAndSwingSword());
					}
					this.angle = m.angle;
				}
			}
			if(this.sword && this.released == true && this.charge <= 0) {
				this.cycle = 0;
				Matter.Body.setAngularVelocity(this.sword, 0);
				player.force.x *= 0.01;
				player.force.y *= 0.01;
				Composite.remove(engine.world, this.sword);
				this.sword.parts.forEach(part => {
					Composite.remove(engine.world, part);
					const index = bullet.indexOf(part);
					if (index !== -1) {
						bullet.splice(index, 1);
					}
				});
				this.sword = undefined;
				if(this.constraint) {
					Composite.remove(engine.world, this.constraint);
					this.constraint = undefined;
				}
				this.bladeTrails = [];
				this.charge = 0;
				this.released = false;
			} else {
				if (!this.isBroken && this.sword && (tech.isEnergyHealth ? m.energy >= 0.11 : m.health >= 0.11)) {
					if(tech.infinityEdge) {
						const newSize = Math.sqrt(0.5 * m.health) + 1;
						Matter.Body.scale(this.sword, newSize * (1 / (this.sword.scale == undefined ? 1 : this.sword.scale)), newSize * (1 / (this.sword.scale == undefined ? 1 : this.sword.scale)), this.sword.position);
						this.sword.scale = newSize;
					}
					let handle;
					for(let i = 0; i < bullet.length; i++) {
						if(bullet[i].customName == "handle") {
							 handle = bullet[i];
						}
					}
					Matter.Body.setAngle(this.sword, m.angle + (Math.PI / 2))
					if(!this.released) {
						this.sword.force.x -= Math.cos(m.angle) * this.charge;
						this.sword.force.y -= Math.sin(m.angle) * this.charge;
						if(this.charge > 10 && !input.fire) {
							this.released = true;
						} 
						if(this.charge <= 10) {
							this.charge += 0.2;
						}
						const flashEffect = Math.sin((2 * Math.PI * this.cycle) / (50))
						const radius = 100;
						ctx.beginPath();
						ctx.lineWidth = 2;
						ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
						ctx.arc(simulation.mouseInGame.x, simulation.mouseInGame.y, radius, 0, Math.PI * 2 * (this.charge / 10));
						ctx.stroke();
						if((this.charge / 10) >= 1 && flashEffect > 0) {
							ctx.beginPath();
							ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
							ctx.moveTo(simulation.mouseInGame.x, simulation.mouseInGame.y - radius);
							ctx.lineTo(simulation.mouseInGame.x + radius, simulation.mouseInGame.y);
							ctx.lineTo(simulation.mouseInGame.x, simulation.mouseInGame.y + radius);
							ctx.lineTo(simulation.mouseInGame.x - radius, simulation.mouseInGame.y);
							ctx.closePath();
							ctx.fill();
							
							ctx.beginPath();
							ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
							ctx.lineWidth = 18;
							ctx.moveTo(simulation.mouseInGame.x, simulation.mouseInGame.y - 75);
							ctx.lineTo(simulation.mouseInGame.x, simulation.mouseInGame.y + 25);
							ctx.stroke();
							ctx.beginPath();
							ctx.moveTo(simulation.mouseInGame.x + 5, simulation.mouseInGame.y + 70);
							ctx.arc(simulation.mouseInGame.x, simulation.mouseInGame.y + 70, 5, 0, 2 * Math.PI);
							ctx.stroke();
						}
					} else {
						if(this.charge > 0) {
							this.charge -= 0.5;
							this.sword.force.x += Math.cos(m.angle) * this.charge * 2 * Math.sqrt(this.sword.mass);
							this.sword.force.y += Math.sin(m.angle) * this.charge * 2 * Math.sqrt(this.sword.mass);
						} else {
							m.fireCDcycle = m.cycle + 100;
						}
					}
					if(!this.constraint && (m.angle > -Math.PI / 2 && m.angle < Math.PI / 2)) {
						this.constraint = Constraint.create({
							pointA: player.position,
							bodyB: this.sword,
							pointB: {x: -9, y: 0},
							stiffness: 0.09,
							damping: 0.9,
							length: 0,
						});
						Composite.add(engine.world, this.constraint);
					} else if(!this.constraint) {
						this.constraint = Constraint.create({
							pointA: player.position,
							bodyB: this.sword,
							pointB: {x: 9, y: 0},
							stiffness: 0.09,
							damping: 0.9,
							length: 0,
						});
						Composite.add(engine.world, this.constraint);
					}
				} else {
					if(this.sword) {
						this.cycle = 0;
						Matter.Body.setAngularVelocity(this.sword, 0);
						player.force.x *= 0.01;
						player.force.y *= 0.01;
						if(player.velocity > 4) {
							Matter.Body.setVelocity(player, {
								x: player.velocity * 0.01, 
								y: player.velocity * 0.01
							})
						}
						Composite.remove(engine.world, this.sword);
						this.sword.parts.forEach(part => {
							Composite.remove(engine.world, part);
							const index = bullet.indexOf(part);
							if (index !== -1) {
								bullet.splice(index, 1);
							}
						});
						this.sword = undefined;
						if(this.constraint) {
							Composite.remove(engine.world, this.constraint);
							this.constraint = undefined;
						}
						this.bladeTrails = [];
						this.charge = 0;
						this.released = false;
					}
				}
			}
		},
		normalFire() {
			if(this.technique.active) {
				if(this.sword) {
					this.cycle = 0;
					Matter.Body.setAngularVelocity(this.sword, 0);
					player.force.x *= 0.01;
					player.force.y *= 0.01;
					Composite.remove(engine.world, this.sword);
					this.sword.parts.forEach(part => {
						Composite.remove(engine.world, part);
						const index = bullet.indexOf(part);
						if (index !== -1) {
							bullet.splice(index, 1);
						}
					});
					this.brokenParts.forEach(part => {
						Composite.remove(engine.world, part);
					});
					this.sword = undefined;
					if(this.constraint) {
						Composite.remove(engine.world, this.constraint);
						this.constraint = undefined;
					}
					this.bladeTrails = [];
					this.bladeSegments = undefined;
					m.fireCDcycle = m.cycle + 10;
				}
				return;
			}
			if(this.constraint) {
				this.constraint.pointA = player.position;
			}
			if (this.isBroken) {
				for (let p of this.brokenParts) {
					for (let i = 0; i < mob.length; i++) {
						if (Matter.Query.collides(p, [mob[i]]).length > 0) {
							mob[i].damage(1);
							break;
						}
					}
				}
				if(!m.crouch && this.isBroken) {
					this.reformSword();
				}
				return;
			}
			if(tech.isStabSword && !m.crouch && this.cycle > 0 && this.stabStatus) {
				if(this.sword) {
					this.stabStatus = false;
					if(tech.isEnergyHealth) {
						m.energy = 0.01;
						m.immuneCycle = m.cycle + 30;
					}
					this.cycle = 0;
					Matter.Body.setAngularVelocity(this.sword, 0);
					Composite.remove(engine.world, this.sword);
					this.sword.parts.forEach(part => {
						Composite.remove(engine.world, part);
						const index = bullet.indexOf(part);
						if (index !== -1) {
							bullet.splice(index, 1);
						}
					});
					this.brokenParts.forEach(part => {
						Composite.remove(engine.world, part);
					});
					this.sword = undefined;
					if(this.constraint) {
						Composite.remove(engine.world, this.constraint);
						this.constraint = undefined;
					}
					this.bladeTrails = [];
					m.fireCDcycle = 0;
				}
			}
			if(input.fire && (tech.isEnergyHealth ? m.energy >= 0.11 : m.health >= 0.11)) {
				if(tech.isEnergyHealth) {
					m.energy -= 0.004;
				} else {
					m.health -= 0.001 * (input.down ? 0.5 : 1);
					m.displayHealth();
				}
			}
			if (input.fire && (tech.isEnergyHealth ? m.energy >= 0.11 : m.health >= 0.11)) {
				if (!this.sword && b.guns[b.activeGun].name === 'sword') {
					if(tech.greatSword) {
						({ sword: this.sword, bladeSegments: this.bladeSegments} = this.greatSword());
					} else if(tech.longSword) {
						({ sword: this.sword, bladeSegments: this.bladeSegments} = this.longSword());
					} else {
						({ sword: this.sword, bladeSegments: this.bladeSegments} = this.createAndSwingSword());
					}
					this.angle = m.angle;
				}
			}
			if(this.sword && !input.fire) {
				this.cycle = 0;
				Matter.Body.setAngularVelocity(this.sword, 0);
				player.force.x *= 0.01;
				player.force.y *= 0.01;
				Composite.remove(engine.world, this.sword);
				this.sword.parts.forEach(part => {
					Composite.remove(engine.world, part);
					const index = bullet.indexOf(part);
					if (index !== -1) {
						bullet.splice(index, 1);
					}
				});
				this.brokenParts.forEach(part => {
					Composite.remove(engine.world, part);
				});
				this.sword = undefined;
				if(this.constraint) {
					Composite.remove(engine.world, this.constraint);
					this.constraint = undefined;
				}
				this.bladeTrails = [];
				this.bladeSegments = undefined;
				m.fireCDcycle = m.cycle + 10;
			} else {
				if (this.sword && (tech.isEnergyHealth ? m.energy >= 0.11 : m.health >= 0.11)) {
					if(tech.infinityEdge) {
						const newSize = Math.sqrt(0.5 * m.health) + 1;
						Matter.Body.scale(this.sword, newSize * (1 / (this.sword.scale == undefined ? 1 : this.sword.scale)), newSize * (1 / (this.sword.scale == undefined ? 1 : this.sword.scale)), this.sword.position);
						this.sword.scale = newSize;
					}
					if(!this.isReforming) {
						if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
							Matter.Body.setAngularVelocity(this.sword, -Math.PI * 0.1 * (tech.greatSword ? 0.75 : 1) * (tech.longSword ? 0.6 : 1));
						} else {
							Matter.Body.setAngularVelocity(this.sword, Math.PI * 0.1 * (tech.greatSword ? 0.75 : 1) * (tech.longSword ? 0.6 : 1));
						}
					}
					if(tech.sizeIllusion) {
						player.force.x += Math.cos(m.angle) * player.mass / 500;
						player.force.y += Math.sin(m.angle) * player.mass / 500;
					}
					if(!this.constraint && (m.angle > -Math.PI / 2 && m.angle < Math.PI / 2)) {
						this.constraint = Constraint.create({
							pointA: player.position,
							bodyB: this.sword,
							pointB: {x: tech.longSword ? -75 : (tech.greatSword ? -50 : -9), y: (tech.longSword ? 275 : 200)},
							stiffness: (tech.infinityEdge ? 0.05 : 0.1),
							damping: 0.001815,
							length: 0,
							
						});
						Composite.add(engine.world, this.constraint);
					} else if(!this.constraint) {
						this.constraint = Constraint.create({
							pointA: player.position,
							bodyB: this.sword,
							pointB: {x: tech.longSword ? 75 : (tech.greatSword ? 50 : 9), y: (tech.longSword ? 275 : 200)},
							stiffness: (tech.infinityEdge ? 0.05 : 0.1),
							damping: 0.001815,
							length: 0,
						});
						Composite.add(engine.world, this.constraint);
					}
					if(m.crouch && !this.isBroken && tech.heavenlyArray) {
						this.breakSword();
					} else if(!m.crouch && this.isBroken) {
						this.reformSword();
					}
				} else if(this.sword) {
					if(tech.isEnergyHealth) {
						m.energy = 0.01;
						m.immuneCycle = m.cycle + 30;
					}
					this.cycle = 0;
					Matter.Body.setAngularVelocity(this.sword, 0);
					player.force.x *= 0.01;
					player.force.y *= 0.01;
					Composite.remove(engine.world, this.sword);
					this.sword.parts.forEach(part => {
						Composite.remove(engine.world, part);
						const index = bullet.indexOf(part);
						if (index !== -1) {
							bullet.splice(index, 1);
						}
					});
					this.brokenParts.forEach(part => {
						Composite.remove(engine.world, part);
					});
					this.sword = undefined;
					if(this.constraint) {
						Composite.remove(engine.world, this.constraint);
						this.constraint = undefined;
					}
					this.bladeTrails = [];
					this.bladeSegments = undefined;
					m.fireCDcycle = 0;
				}
			}
		},
		createAndSwingSword(x = player.position.x, y = player.position.y, angle = m.angle) {
			const handleWidth = 20;
			const handleHeight = 150;
			const handle = Bodies.rectangle(x, y, handleWidth, handleHeight, spawn.propsIsNotHoldable);
			const pommelWidth = 30;
			const pommelHeight = 40;
			const pommelVertices = [
				{ x: x, y: y + handleHeight / 2 + pommelHeight / 2 },
				{ x: x + pommelWidth / 2, y: y + handleHeight / 2 },
				{ x: x, y: y + handleHeight / 2 - pommelHeight / 2 },
				{ x: x - pommelWidth / 2, y: y + handleHeight / 2 },
			];
			const pommel = Bodies.fromVertices(x, y + handleHeight / 2, pommelVertices, spawn.propsIsNotHoldable);
			const bladeWidth = 100 * (tech.soundSword ? 3 : 1);
			const bladeHeight = 20 * (tech.soundSword ? 3 : 1);
			const numBlades = 15;
			const extensionFactor = 5;
			const bladeSegments = [];
			bladeSegments.push(handle);
			if ((angle > -Math.PI / 2 && angle < Math.PI / 2)) {
				for (let i = 0; i < numBlades; i++) {
					const extensionFactorFraction = (i / (numBlades - 1)) * extensionFactor;
					const bladeX = x + i * (bladeWidth / 20);
					const bladeY = y - handleHeight / 2 - i * (bladeHeight / 4.5) * extensionFactor;
		
					const vertices = [
						{ x: bladeX, y: bladeY - bladeHeight / 2 }, 
						{ x: bladeX + bladeWidth / 2, y: bladeY + bladeHeight / 2 },
						{ x: bladeX - bladeWidth / 2, y: bladeY + bladeHeight / 2 },
						{ x: bladeX, y: bladeY - bladeHeight / 2 + 10 },
					];
		
					const blade = Bodies.fromVertices(bladeX, bladeY, vertices, spawn.propsIsNotHoldable);
					Matter.Body.rotate(blade, -Math.sin(i * (Math.PI / 270) * 15));
					bladeSegments.push(blade);
				}
			} else {
				for (let i = 0; i < numBlades; i++) {
					const extensionFactorFraction = (i / (numBlades - 1)) * extensionFactor;
					const mirroredBladeX = x - i * (bladeWidth / 20);
					const mirroredBladeY = y - handleHeight / 2 - i * (bladeHeight / 4.5) * extensionFactor;
					const mirroredVertices = [
						{ x: mirroredBladeX, y: mirroredBladeY - bladeHeight / 2 },
						{ x: mirroredBladeX + bladeWidth / 2, y: mirroredBladeY + bladeHeight / 2 },
						{ x: mirroredBladeX - bladeWidth / 2, y: mirroredBladeY + bladeHeight / 2 },
						{ x: mirroredBladeX, y: mirroredBladeY - bladeHeight / 2 + 10 },
					];
					const mirroredBlade = Bodies.fromVertices(mirroredBladeX, mirroredBladeY, mirroredVertices, spawn.propsIsNotHoldable);
					Matter.Body.rotate(mirroredBlade, Math.sin(i * (Math.PI / 270) * 15));
					bladeSegments.push(mirroredBlade);
				}
			}
			bladeSegments.push(pommel);
			const sword = Body.create({
				parts: [...bladeSegments],
			});
			Composite.add(engine.world, sword);
			Matter.Body.setPosition(sword, { x, y });
			sword.collisionFilter.category = cat.bullet;
			sword.collisionFilter.mask = cat.mobBullet | cat.powerup | cat.mob;
			Body.scale(sword, -1, 1, { x, y });
			return { sword, bladeSegments };
		},
		greatSword(position = player.position) {
			let x = position.x;
			let y = position.y;
			const handleWidth = 20;
			const handleHeight = 120;
			const handle = Bodies.rectangle(x, y, handleWidth, handleHeight, spawn.propsIsNotHoldable);
			// bullet[bullet.length] = handle;
			// handle.customName = "handle";
			// bullet[bullet.length - 1].do = () => {};
			const pommelWidth = 30;
			const pommelHeight = 40;
			const pommelVertices = [
				{ x: x, y: y + handleHeight / 2 + pommelHeight / 2 },
				{ x: x + pommelWidth / 2, y: y + handleHeight / 2 },
				{ x: x, y: y + handleHeight / 2 - pommelHeight / 2 },
				{ x: x - pommelWidth / 2, y: y + handleHeight / 2 },
			];
			const pommel = Bodies.fromVertices(x, y + handleHeight / 2, pommelVertices, spawn.propsIsNotHoldable);
			const crossWidth = 50;
			const crossHeight = 15;
			const crossVertices = [
				{ x: x + crossWidth, y: y },
				{ x: x, y: y - crossHeight},
				{ x: x - crossWidth, y: y },
				{ x: x, y: y + crossHeight},
			];
			const cross = Bodies.fromVertices(x, y - handleHeight / 2, crossVertices, spawn.propsIsNotHoldable);
			const leftOuterVertices = [
				{ x: x, y: y - 95 },
				{ x: x + 15, y: y - 120 },
				{ x: x + 15, y: y },
				{ x: x, y: y },
			];
			const leftOuter = Bodies.fromVertices(x + 15, y - handleHeight, leftOuterVertices, spawn.propsIsNotHoldable);
			// bullet[bullet.length] = leftOuter;
			// bullet[bullet.length - 1].do = () => {};
			const rightOuterVertices = [
				{ x: x, y: y - 95 },
				{ x: x - 15, y: y - 120 },
				{ x: x - 15, y: y },
				{ x: x, y: y },
			];
			const rightOuter = Bodies.fromVertices(x - 15, y - handleHeight, rightOuterVertices, spawn.propsIsNotHoldable);
			const cross2Width = 20;
			const cross2Height = 30;
			const cross2Vertices = [
				{ x: x + cross2Width, y: y },
				{ x: x, y: y - cross2Height},
				{ x: x - cross2Width, y: y },
				{ x: x, y: y + cross2Height},
			];
			const cross2 = Bodies.fromVertices(x, y - handleHeight - 95, cross2Vertices, spawn.propsIsNotHoldable);
			const leftHigherVertices = [
				{ x: x, y: y + 95 },
				{ x: x + 15, y: y + 120 },
				{ x: x + 15, y: y },
				{ x: x, y: y - 50 },
			];
			const leftHigher = Bodies.fromVertices(x + 15, y - handleHeight * 2 - 85, leftHigherVertices, spawn.propsIsNotHoldable);
			const rightHigherVertices = [
				{ x: x, y: y + 95 },
				{ x: x - 15, y: y + 120 },
				{ x: x - 15, y: y },
				{ x: x, y: y - 50 },
			];
			const rightHigher = Bodies.fromVertices(x - 15, y - handleHeight * 2 - 85, rightHigherVertices, spawn.propsIsNotHoldable);
			const decor1Vertices = [
				{ x: x, y: y },
				{ x: x + 10, y: y },
				{ x: x + 40, y: y - 70},
				{ x: x + 30, y: y - 70 },
			];
			const decor1 = Bodies.fromVertices(x + 30, y - handleHeight / 2 - 50, decor1Vertices, spawn.propsIsNotHoldable);
			const decor2Vertices = [
				{ x: x, y: y },
				{ x: x - 10, y: y },
				{ x: x - 80, y: y - 120},
				{ x: x - 70, y: y - 120 },
			];
			const decor2 = Bodies.fromVertices(x + 10, y - handleHeight / 2 - 150, decor2Vertices, spawn.propsIsNotHoldable);
			const decor3Vertices = [
				{ x: x, y: y },
				{ x: x + 10, y: y },
				{ x: x + 40, y: y - 70},
				{ x: x + 40, y: y - 80 },
			];
			const decor3 = Bodies.fromVertices(x - 10, y - handleHeight / 2 - 247, decor3Vertices, spawn.propsIsNotHoldable);
			const decor4Vertices = [
				{ x: x, y: y + 6},
				{ x: x - 10, y: y + 6 },
				{ x: x - 40, y: y - 70},
				{ x: x - 30, y: y - 70 },
			];
			const decor4 = Bodies.fromVertices(x - 30, y - handleHeight / 2 - 47, decor4Vertices, spawn.propsIsNotHoldable);						
			const decor5Vertices = [
				{ x: x, y: y },
				{ x: x + 10, y: y },
				{ x: x + 80, y: y - 120},
				{ x: x + 70, y: y - 120 },
			];
			const decor5 = Bodies.fromVertices(x - 10, y - handleHeight / 2 - 150, decor5Vertices, spawn.propsIsNotHoldable);
			const decor6Vertices = [
				{ x: x, y: y },
				{ x: x - 10, y: y },
				{ x: x - 35, y: y - 70},
				{ x: x - 35, y: y - 80 },
			];
			const decor6 = Bodies.fromVertices(x + 12, y - handleHeight / 2 - 246, decor6Vertices, spawn.propsIsNotHoldable);
			const sword = Body.create({
				parts: [handle, leftOuter, rightOuter, rightHigher, decor1, decor2, decor3, leftHigher, decor4, decor5, decor6, pommel, cross, cross2],
			});
			Composite.add(engine.world, sword);
			Matter.Body.setPosition(sword, { 
				x: x, 
				y: y
			});
			Matter.Body.setVelocity(sword, { 
				x: 0, 
				y: 0
			});
			sword.collisionFilter.category = cat.bullet;
			sword.collisionFilter.mask = cat.mobBullet | cat.powerup | cat.mob | cat.body | cat.bullet;
			Body.scale(sword, -1, 1, { x, y });
			return { sword, bladeSegments: [handle, rightOuter, rightHigher, decor1, decor4, leftOuter, decor2, decor3, leftHigher, decor5, decor6, pommel, cross, cross2] };
        },
		longSword(position = player.position) {
			let x = position.x;
			let y = position.y;
			const handleWidth = 20;
			const handleHeight = 180;
			const handle = Bodies.rectangle(x, y, handleWidth, handleHeight, spawn.propsIsNotHoldable);
			const eye = Bodies.circle(x, y - handleHeight / 2, 20, spawn.propsIsNotHoldable);
			const pommelWidth = 30;
			const pommelHeight = 40;
			const pommelVertices = [
				{ x: x, y: y + handleHeight / 2 + pommelHeight / 2 },
				{ x: x + pommelWidth / 2, y: y + handleHeight / 2 },
				{ x: x, y: y + handleHeight / 2 - pommelHeight / 2 },
				{ x: x - pommelWidth / 2, y: y + handleHeight / 2 },
			];
			const pommel = Bodies.fromVertices(x, y + handleHeight / 2, pommelVertices, spawn.propsIsNotHoldable);
			const crossWidth = 50;
			const crossHeight = 15;
			const crossVertices = [
				{ x: x + crossWidth, y: y },
				{ x: x, y: y - crossHeight},
				{ x: x - crossWidth, y: y },
				{ x: x, y: y + crossHeight},
			];
			const cross = Bodies.fromVertices(x, y - handleHeight / 2, crossVertices, spawn.propsIsNotHoldable);					
			const blade1Vertices = [
				{ x: x, y: y - 750 },
				{ x: x + 15, y: y - 650 },
				{ x: x + 10, y: y },
				{ x: x - 10, y: y },
				{ x: x - 15, y: y - 650 },
			];
			const blade1 = Bodies.fromVertices(x, y - handleHeight - 290, blade1Vertices, spawn.propsIsNotHoldable);					
			const blade2Vertices = [
				{ x: x + 20, y: y },
				{ x: x, y: y - 30 },
				{ x: x - 20, y: y },
				{ x: x, y: y + 10 },
			];
			const blade2 = Bodies.fromVertices(x, y - handleHeight + 50, blade2Vertices, spawn.propsIsNotHoldable);		
			const cross2Vertices = [
				{ x: x, y: y - 10 },
				{ x: x + 27, y: y },
				{ x: x, y: y + 10 },
				{ x: x - 7, y: y },
			];
			const cross2 = Bodies.fromVertices(x - crossWidth, y - handleHeight / 2, cross2Vertices, spawn.propsIsNotHoldable);				
			const cross3Vertices = [
				{ x: x, y: y - 10 },
				{ x: x + 7, y: y },
				{ x: x, y: y + 10 },
				{ x: x - 27, y: y },
			];
			const cross3 = Bodies.fromVertices(x + crossWidth, y - handleHeight / 2, cross3Vertices, spawn.propsIsNotHoldable);				
			const cross4Vertices = [
				{ x: x, y: y },
				{ x: x - 10, y: y },
				{ x: x - 15, y: y + 50 },
			];
			const cross4 = Bodies.fromVertices(x + crossWidth, y - handleHeight / 2 + 25, cross4Vertices, spawn.propsIsNotHoldable);				
			const cross5Vertices = [
				{ x: x, y: y },
				{ x: x - 10, y: y },
				{ x: x + 5, y: y + 50 },
			];
			const cross5 = Bodies.fromVertices(x - crossWidth, y - handleHeight / 2 + 25, cross5Vertices, spawn.propsIsNotHoldable);				
			const cross6Vertices = [
				{ x: x, y: y - 50 },
				{ x: x + 10, y: y },
				{ x: x, y: y + 50 },
				{ x: x - 10, y: y },
			];
			const cross6 = Bodies.fromVertices(x, y - handleHeight / 2, cross6Vertices, spawn.propsIsNotHoldable);		
			const cross7Vertices = [
				{ x: x, y: y },
				{ x: x - 10, y: y },
				{ x: x - 15, y: y - 50 },
			];
			const cross7 = Bodies.fromVertices(x + crossWidth, y - handleHeight / 2 - 25, cross7Vertices, spawn.propsIsNotHoldable);				
			const cross8Vertices = [
				{ x: x, y: y },
				{ x: x - 10, y: y },
				{ x: x + 5, y: y - 50 },
			];
			const cross8 = Bodies.fromVertices(x - crossWidth, y - handleHeight / 2 - 25, cross8Vertices, spawn.propsIsNotHoldable);		
			const slitVertices = [
				{ x: x, y: y - 20 },
				{ x: x + 5, y: y },
				{ x: x, y: y + 20 },
				{ x: x - 5, y: y },
			];
			const slit = Bodies.fromVertices(x, y - handleHeight / 2, slitVertices, spawn.propsIsNotHoldable);	
			const sword = Body.create({
				parts: [handle, pommel, blade1, blade2, cross4, cross5, cross7, cross8, cross, cross2, cross3, cross6, eye, slit],
			});
			Composite.add(engine.world, sword);
			Matter.Body.setPosition(sword, { 
				x: x, 
				y: y
			});
			Matter.Body.setVelocity(sword, { 
				x: 0, 
				y: 0
			});
			sword.collisionFilter.category = cat.bullet;
			sword.collisionFilter.mask = cat.mobBullet | cat.powerup | cat.mob | cat.body | cat.bullet;
			sword.restitution = 0;
			Body.scale(sword, -1, 1, { x, y });
			return { sword, bladeSegments: [handle, pommel, blade1, blade2, cross4, cross5, cross7, cross8, cross, cross2, cross3, cross6, eye, slit] };
		},
		renderDefault() {
			if(this.sword) {
				for (let i = 0; i < this.bladeSegments.length; i++) {
					const blade = this.bladeSegments[i];
					const trail = this.bladeTrails[i] || [];
					const vertices = blade.vertices.map(vertex => ({ x: vertex.x, y: vertex.y }));
					trail.push(vertices);
					if (trail.length > 10) {
						trail.shift();
					}
					this.bladeTrails[i] = trail;
				}
	
				for (let i = 0; i < this.bladeTrails.length; i++) {
					const trail = this.bladeTrails[i];
	
					const alphaStep = 1 / trail.length;
					let alpha = 0;
	
					for (let j = 0; j < trail.length; j++) {
						const vertices = trail[j];
						ctx.beginPath();
						ctx.moveTo(vertices[0].x, vertices[0].y);
	
						for (let k = 1; k < vertices.length; k++) {
							ctx.lineTo(vertices[k].x, vertices[k].y);
						};
	
						alpha += alphaStep;
						ctx.closePath();
						if(tech.isEnergyHealth) {
							const eyeColor = m.fieldMeterColor;    
							const r = eyeColor[1];
							const g = eyeColor[2];
							const b = eyeColor[3];
							const color = `#${r}${r}${g}${g}${b}${b}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
							ctx.fillStyle = color;
						} else {
							ctx.fillStyle = `rgba(220, 20, 60, ${alpha})`;
						}
						ctx.fill();
					}
				}
				if(!tech.greatSword) {
					for(let i = 0; i < this.bladeSegments.length; i++) {
						if(!this.bladeSegments[i].render) continue;
						ctx.beginPath();
						ctx.lineJoin = "miter";
						ctx.miterLimit = 100;
						ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : tech.isAmmoSword ? "#c0c0c0" : "crimson";
						ctx.lineWidth = 5;
						ctx.fillStyle = "black";
						ctx.moveTo(this.bladeSegments[i].vertices[0].x, this.bladeSegments[i].vertices[0].y);
						for(let j = 0; j < this.bladeSegments[i].vertices.length; j++) {
							ctx.lineTo(this.bladeSegments[i].vertices[j].x, this.bladeSegments[i].vertices[j].y)
						};
						ctx.closePath();
						ctx.stroke();
						ctx.fill();
						ctx.lineJoin = "round";
						ctx.miterLimit = 10;
					}
				}
			}
		},		
		renderLongsword() {
			if(this.sword) {
				for (let i = 0; i < this.bladeSegments.length; i++) {
					const blade = this.bladeSegments[i];
					const trail = this.bladeTrails[i] || [];
					const tip = blade.vertices[1];
					const base = blade.vertices[blade.vertices.length - 2];

					trail.push({ tip: { x: tip.x, y: tip.y }, base: { x: base.x, y: base.y } });

					if (trail.length > 15) {
						trail.shift();
					}

					this.bladeTrails[i] = trail;
				}
				for (let i = 0; i < this.bladeTrails.length; i++) {
					const trail = this.bladeTrails[i];
					if (this.bladeTrails[2] != trail) continue;
					ctx.save();
					ctx.beginPath();
					const gradient = ctx.createLinearGradient(
						trail[0].tip.x, trail[0].tip.y, 
						trail[trail.length - 1].tip.x, trail[trail.length - 1].tip.y
					);
					gradient.addColorStop(0, "rgba(180, 0, 220, 0)");
					gradient.addColorStop(1, "rgba(220, 220, 220, 1)");
					ctx.fillStyle = gradient;
					ctx.moveTo(trail[0].tip.x, trail[0].tip.y);
					for (let j = 1; j < trail.length; j++) {
						ctx.lineTo(trail[j].tip.x, trail[j].tip.y);
					}
					for (let j = trail.length - 1; j >= 0; j--) {
						ctx.lineTo(trail[j].base.x, trail[j].base.y);
					}
					ctx.closePath();
					ctx.fill();
					ctx.restore();
				}
				for(let i = 0; i < this.bladeSegments.length; i++) {
					if(!this.bladeSegments[i].render) continue;
					ctx.save();
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : "rgba(180, 0, 220, 0.2)";
					ctx.lineWidth = 15;
					ctx.moveTo(this.bladeSegments[i].vertices[0].x, this.bladeSegments[i].vertices[0].y);
					for(let j = 0; j < this.bladeSegments[i].vertices.length; j++) {
						ctx.lineTo(this.bladeSegments[i].vertices[j].x, this.bladeSegments[i].vertices[j].y)
					};
					ctx.closePath();
					ctx.stroke();
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : "rgba(180, 0, 220, 0.8)";
					ctx.lineWidth = 10;
					ctx.moveTo(this.bladeSegments[i].vertices[0].x, this.bladeSegments[i].vertices[0].y);
					for(let j = 0; j < this.bladeSegments[i].vertices.length; j++) {
						ctx.lineTo(this.bladeSegments[i].vertices[j].x, this.bladeSegments[i].vertices[j].y)
					};
					ctx.closePath();
					ctx.stroke();
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : "white";
					ctx.lineWidth = 5;
					ctx.fillStyle = "black";
					ctx.moveTo(this.bladeSegments[i].vertices[0].x, this.bladeSegments[i].vertices[0].y);
					for(let j = 0; j < this.bladeSegments[i].vertices.length; j++) {
						ctx.lineTo(this.bladeSegments[i].vertices[j].x, this.bladeSegments[i].vertices[j].y)
					};
					ctx.closePath();
					ctx.fill();
					ctx.stroke();
					ctx.restore();
				}
			}
		},
		renderSoundSword() {
			if (this.sword) {
				color.bullet = "transparent";
				if(this.cycle > 20 && (!tech.isStabSword && !input.down)) {
					this.cycle = 0;
					Matter.Body.setAngularVelocity(this.sword, 0);
					player.force.x *= 0.01;
					player.force.y *= 0.01;
					Composite.remove(engine.world, this.sword);
					this.sword.parts.forEach(part => {
						Composite.remove(engine.world, part);
						const index = bullet.indexOf(part);
						if (index !== -1) {
							bullet.splice(index, 1);
						}
					});
					this.sword = undefined;
					if(this.constraint) {
						Composite.remove(engine.world, this.constraint);
						this.constraint = undefined;
					}
					m.fireCDcycle = m.cycle + 10;
				}
				for (let i = 0; i < this.bladeSegments.length; i++) {
					const blade = this.bladeSegments[i];
					const trail = this.bladeTrails[i] || [];
					const vertices = blade.vertices.map(vertex => ({ x: vertex.x, y: vertex.y }));
					trail.push(vertices);
					if (trail.length > 10) {
						trail.shift();
					}
					this.bladeTrails[i] = trail;
				}
	
				for (let i = 0; i < this.bladeTrails.length; i++) {
					const trail = this.bladeTrails[i];
	
					const alphaStep = 0.01 / trail.length;
					let alpha = 0;
	
					for (let j = 0; j < trail.length; j++) {
						const vertices = trail[j];
						ctx.beginPath();
						ctx.moveTo(vertices[0].x, vertices[0].y);
	
						for (let k = 1; k < vertices.length; k++) {
							ctx.lineTo(vertices[k].x, vertices[k].y);
						};
	
						alpha += alphaStep;
						ctx.closePath();
						if(tech.isEnergyHealth) {
							const eyeColor = m.fieldMeterColor;    
							const r = eyeColor[1];
							const g = eyeColor[2];
							const b = eyeColor[3];
							const color = `#${r}${r}${g}${g}${b}${b}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
							ctx.fillStyle = color;
						} else {
							ctx.fillStyle = `rgba(60, 10, 60, ${alpha})`;
						}
						ctx.fill();
					}
				}
				for(let i = 0; i < this.bladeSegments.length; i++) {
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : `rgba(60, 10, 60, 0.01)`;
					ctx.lineWidth = 5;
					ctx.fillStyle = "transparent";
					ctx.moveTo(this.bladeSegments[i].vertices[0].x, this.bladeSegments[i].vertices[0].y);
					for(let j = 0; j < this.bladeSegments[i].vertices.length; j++) {
						ctx.lineTo(this.bladeSegments[i].vertices[j].x, this.bladeSegments[i].vertices[j].y)
					};
					ctx.closePath();
					ctx.stroke();
					ctx.fill();
					ctx.lineJoin = "round";
					ctx.miterLimit = 10;
				}
			} else {
				color.bullet = "black"
			}
		},
		breakSword() {
			if (!this.sword || this.isBroken || this.isReforming) return;
			this.isBroken = true;
			Composite.remove(engine.world, this.sword);
			this.brokenParts.forEach(part => {
				Composite.remove(engine.world, part);
			});
			this.brokenParts = [];
			for (let i = 0; i < this.bladeSegments.length; i++) {
				const part = this.bladeSegments[i];
				const newPart = Bodies.fromVertices(
					part.position.x,
					part.position.y,
					part.vertices,
					spawn.propsIsNotHoldable
				);
				newPart.frictionAir = 0.08;
				newPart.gravityScale = 0;
				newPart.collisionFilter.category = cat.bullet;
				newPart.collisionFilter.mask = cat.mobBullet | cat.powerup | cat.mob;
				Composite.add(engine.world, newPart);
				this.brokenParts.push(newPart);
			}
			this.sword = null;
		},
		getRandomOrbitPoint(px, py, minR, maxR) {
			const angle = Math.random() * Math.PI * 2;
			const radius = minR + Math.random() * (maxR - minR);

			return {
				x: px + Math.cos(angle) * radius,
				y: py + Math.sin(angle) * radius
			};
		},
		reformSword() {
			if (!this.isBroken) return;
			if (!this.sword && input.fire) {
				if(this.constraint) {
					Composite.remove(engine.world, this.constraint);
					this.constraint = undefined;
				}
				if (tech.greatSword) {
					({ sword: this.sword, bladeSegments: this.bladeSegments } = this.greatSword());
				} else if (tech.longSword) {
					({ sword: this.sword, bladeSegments: this.bladeSegments } = this.longSword());
				} else {
					({ sword: this.sword, bladeSegments: this.bladeSegments } = this.createAndSwingSword());
				}
				if(!this.constraint && (m.angle > -Math.PI / 2 && m.angle < Math.PI / 2)) {
					this.constraint = Constraint.create({
						pointA: player.position,
						bodyB: this.sword,
						pointB: {x: tech.longSword ? -75 : (tech.greatSword ? -50 : -9), y: (tech.longSword ? 275 : 200)},
						stiffness: (tech.infinityEdge ? 0.05 : 0.1),
						damping: 0.001815,
						length: 0,
						
					});
					Composite.add(engine.world, this.constraint);
				} else if(!this.constraint) {
					this.constraint = Constraint.create({
						pointA: player.position,
						bodyB: this.sword,
						pointB: {x: tech.longSword ? 75 : (tech.greatSword ? 50 : 9), y: (tech.longSword ? 275 : 200)},
						stiffness: (tech.infinityEdge ? 0.05 : 0.1),
						damping: 0.001815,
						length: 0,
					});
					Composite.add(engine.world, this.constraint);
				}
			} else {
				if(this.constraint) {
					Composite.remove(engine.world, this.constraint);
					this.constraint = undefined;
				}
				this.bladeSegments = [];
				this.bladeTrails = [];
				this.brokenParts.forEach(part => {
					Composite.remove(engine.world, part);
				});
			}
			for(let i = 0; i < this.bladeSegments.length; i++) {
				this.bladeSegments[i].render = false;
			}
			this.isReforming = true;
			this.isBroken = false;
		},
		blades() {
			if (this.isReforming && this.sword) {
				for (let i = 0; i < this.brokenParts.length; i++) {
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : "crimson";
					ctx.lineWidth = 5;
					ctx.fillStyle = "black";
					ctx.moveTo(this.brokenParts[i].vertices[0].x, this.brokenParts[i].vertices[0].y);
					for(let j = 0; j < this.brokenParts[i].vertices.length; j++) {
						ctx.lineTo(this.brokenParts[i].vertices[j].x, this.brokenParts[i].vertices[j].y)
					};
					ctx.closePath();
					ctx.stroke();
					ctx.fill();
					ctx.lineJoin = "round";
					ctx.miterLimit = 10;
					const shard = this.brokenParts[i];
					const targetPart = (this.bladeSegments[i] ? this.bladeSegments[i] : (this.sword.parts[i] ? this.sword.parts[i] : player));
					if (!targetPart) continue;
					const dx = targetPart.position.x - shard.position.x;
					const dy = targetPart.position.y - shard.position.y;
					Matter.Body.applyForce(shard, shard.position, {
						x: dx * 0.00008,
						y: dy * 0.00008
					});
					Matter.Body.setVelocity(shard, {
						x: shard.velocity.x * 0.96,
						y: shard.velocity.y * 0.96
					});
					if (Matter.Query.collides(this.sword, [shard]).length) {
						Composite.remove(engine.world, shard);
						this.brokenParts.splice(i, 1);
						if(this.bladeSegments[i] && !this.bladeSegments[i].render) {
							this.bladeSegments[i].render = true; 
						} else {
							for(let j = 0; j < this.bladeSegments.length; j++) {
								if(!this.bladeSegments[j].render) {
									this.bladeSegments[j].render = true;
									break;
								}
							}
						}
					} else {
						this.bladeSegments[i].render = false;
					}
				}
				if (this.brokenParts.length === 0) {
					this.isReforming = false;
					for(let i = 0; i < this.bladeSegments.length; i++) {
						this.bladeSegments[i].render = true;
					}
				}
			} else if (this.isReforming && !this.sword) {
				this.brokenParts.forEach(part => {
					Composite.remove(engine.world, part);
				});
				this.isReforming = false;
			}
			if (this.isBroken && this.brokenParts.length) {
				const px = player.position.x;
				const py = player.position.y;
				if(m.energy > 0.01) {
					m.energy -= 0.0034;
				} else {
					this.reformSword();
				}
				for (let i = 0; i < this.brokenParts.length; i++) {
					const blade = this.brokenParts[i];
					const trail = this.bladeTrails[i] || [];
					const vertices = blade.vertices.map(vertex => ({ x: vertex.x, y: vertex.y }));
					trail.push(vertices);
					if (trail.length > 10) {
						trail.shift();
					}
					this.bladeTrails[i] = trail;
				}
	
				for (let i = 0; i < this.bladeTrails.length; i++) {
					const trail = this.bladeTrails[i];
	
					const alphaStep = 1 / trail.length;
					let alpha = 0;
	
					for (let j = 0; j < trail.length; j++) {
						const vertices = trail[j];
						ctx.beginPath();
						ctx.moveTo(vertices[0].x, vertices[0].y);
	
						for (let k = 1; k < vertices.length; k++) {
							ctx.lineTo(vertices[k].x, vertices[k].y);
						};
	
						alpha += alphaStep;
						ctx.closePath();
						if(tech.isEnergyHealth) {
							const eyeColor = m.fieldMeterColor;    
							const r = eyeColor[1];
							const g = eyeColor[2];
							const b = eyeColor[3];
							const color = `#${r}${r}${g}${g}${b}${b}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
							ctx.fillStyle = color;
						} else {
							ctx.fillStyle = `rgba(220, 20, 60, ${alpha})`;
						}
						ctx.fill();
					}
				}
				for (let part of this.brokenParts) {
					part.orbit ??= {
						a: 300 + Math.random() * 250,
						b: 100 + Math.random() * 100,
						angle: Math.random() * Math.PI * 2,
						speed: 0.03 + Math.random() * 0.03,
						zOffset: Math.random()
					};
					const o = part.orbit;
					o.angle += o.speed / 2 + o.speed * (m.energy / m.maxEnergy);
					const targetX = px + o.a * Math.cos(o.angle);
					const targetY = py + o.b * Math.sin(o.angle);
					const scale = 1 - o.zOffset * 0.2;
					const dx = targetX - part.position.x;
					const dy = targetY - part.position.y;
					const strength = 0.0001;
					Matter.Body.applyForce(part, part.position, { x: dx * strength, y: dy * strength });
					Matter.Body.setVelocity(part, { x: part.velocity.x * 0.98, y: part.velocity.y * 0.98 });
					ctx.save();
					ctx.translate(part.position.x, part.position.y);
					ctx.scale(scale, scale);
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : "crimson";
					ctx.lineWidth = 5;
        			ctx.moveTo(part.vertices[0].x - part.position.x, part.vertices[0].y - part.position.y);
					for (let j = 1; j < part.vertices.length; j++) {
						ctx.lineTo(part.vertices[j].x - part.position.x, part.vertices[j].y - part.position.y);
					}
					ctx.closePath();
					ctx.stroke();
					ctx.fillStyle = "black";
					ctx.fill();
					ctx.lineJoin = "round";
					ctx.miterLimit = 10;
					ctx.stroke();
					ctx.restore();
				}
			}
		},
		collision() {
			if(this.sword) {
				for (let i = 0; i < mob.length; i++) {
					if (Matter.Query.collides(this.sword, [mob[i]]).length > 0) {
						const dmg = (m.damageDone ? m.damageDone : m.dmgScale) * Math.sqrt(this.sword.speed) * (tech.sizeIllusion ? 1.1 : 1) * (tech.isStabSword ? 1.5 : 1) * (tech.infinityEdge ? 1.1 : 1) * (tech.greatSword ? 2 : 1) * (tech.longSword ? 1.7 : 1);
						if(!tech.soundSword) {
							if(m.health < m.maxHealth) {
								if(tech.isEnergyHealth) {
									m.energy += 0.04;
								} else {
									m.health += 0.01 * (dmg - mob[i].health);
									m.displayHealth();
								}
							} else {
								if(tech.isEnergyHealth) {
									m.energy += 0.04;
								} else {
									m.health = m.maxHealth;
									m.displayHealth();
								}
							}
						}
						mob[i].damage(dmg, true);
						simulation.drawList.push({
							x: mob[i].position.x,
							y: mob[i].position.y,
							radius: Math.abs(Math.log(dmg * this.sword.speed) * 40 * mob[i].damageReduction + 3),
							color: (tech.soundSword ? "rgba(0, 0, 0, 0.3)": simulation.mobDmgColor),
							time: simulation.drawTime
						});
						if(!tech.soundSword && !tech.greatSword) {
							const angle = Math.atan2(mob[i].position.y - this.sword.position.y, mob[i].position.x - this.sword.position.x);
							this.sword.force.x -= Math.cos(angle) * 10;
							this.sword.force.y -= Math.sin(angle) * 10;
						}
						break
					}
				}
			}
		},
		slowDownTime(scale = 0.5, duration = 50) {
			this.isSlowed = true;
			const originalDelta = simulation.delta;
			const self = this;
			simulation.delta *= scale;
			simulation.ephemera.push({
				count: duration,
				do() {
					this.count--;
					if (this.count <= 0) {
						simulation.delta = originalDelta;
						self.isSlowed = false;
						simulation.removeEphemera(this);
					}
				}
			});
		},
		keyListener(event) {
			if (event.repeat) return;

			const sub = simulation.cycle - this.keyLogCycle[this.keyLogCycle.length - 1];

			if (sub < this.comboWindow || this.keyLogCycle[this.keyLogCycle.length - 1] === 0) {
				this.keyLogCycle.shift();
				this.keyLogCycle.push(simulation.cycle);

				this.keyLog.shift();
				this.keyLog.push(event.code);
			} else {
				this.keyLog = [null, null, null, event.code];
				this.keyLogCycle = [0, 0, 0, simulation.cycle];
			}

			const pattern = [
				input.key.down,
				input.key.down,
				input.key.left,
				input.key.right,
			];
			const arraysEqual = (a, b) =>
				a.length === b.length && a.every((val, i) => val === b[i]);

			if (arraysEqual(this.keyLog, pattern)) {
				this.keyLog = [null, null, null, null];
				this.keyLogCycle = [0, 0, 0, 0];
				if(m.energy >= 0.5) {
					this.activateTechnique();
				} else {
					simulation.inGameConsole(`<em>This technique requires more <b class="color-f">energy<b><em>`);
				}
			}
		},
		activateTechnique() {
			if (this.technique.active) return;
			if (mob.length === 0) return;

			this.technique.active = true;
			this.technique.phase = "slowmo";
			this.technique.timer = 0;
			this.technique.pattern = [];
			this.technique.progress = 0;
		},
		updateTechnique() {
			const nodeSpawn = 10;
			const nodeActive = 18;
			if (this.technique.active && this.shouldSlow) {
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
				sleep([player]);
				simulation.cycle--;

				ctx.globalCompositeOperation = "hue"
				ctx.fillStyle = "#ccc";
				ctx.fillRect(-50000, -50000, 100000, 100000)
				ctx.globalCompositeOperation = "source-over"
			} else {
				if(player.isSleeping && !this.shouldSlow) {
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
					wake([player]);
				}
				if(!this.isSlowed && this.technique.lastKill + 25 > simulation.cycle) this.slowDownTime();
				const radius = 1000;
				const px = player.position.x;
				const py = player.position.y;
				const targets = mob.filter(m2=>{
					if(m2.isMobBullet || m2.isShielded) return false;
					const dx = m2.position.x - px;
					const dy = m2.position.y - py;
					return dx*dx + dy*dy <= radius*radius;
				});
				if (targets.length < 2){
					if (this.technique.active){
						this.technique.active = false;
						this.technique.phase = "idle";
						this.shouldSlow = false;
					}
					return;
				}
				targets.sort((a,b)=>{
					const aa = Math.atan2(a.position.y-py, a.position.x-px);
					const bb = Math.atan2(b.position.y-py, b.position.x-px);
					return aa-bb;
				});
				const start = targets[0];
				const pulse = 1 + Math.sin(simulation.cycle*0.2)*0.15;
				ctx.beginPath();
				ctx.arc(start.position.x, start.position.y, 55*pulse, 0, Math.PI*2);
				ctx.strokeStyle = "rgba(255,80,80,0.85)";
				ctx.lineWidth = 3;
				ctx.stroke();
			}
			const t = this.technique;

			if (t.phase === "slowmo") {
				t.timer++;
				if (t.timer > 10) {
					const radius = 1000;
					const px = player.position.x;
					const py = player.position.y;
					let targets = mob.filter(m2 => {
						if(!m2.isMobBullet && !m2.isShielded && !m2.isInvulnerable) {
							const dx = m2.position.x - px;
							const dy = m2.position.y - py;
							return dx*dx + dy*dy <= radius*radius;
						}
					});

					if (targets.length <= 1) {
						this.technique.pattern = [];
						this.technique.active = false; 
						this.technique.phase = "idle";
						this.shouldSlow = false;
						return;
					} else {
						this.shouldSlow = true;
					}
					targets.sort((a,b)=>{
						const aa = Math.atan2(a.position.y-py, a.position.x-px);
						const bb = Math.atan2(b.position.y-py, b.position.x-px);
						return aa-bb;
					});

					const pts = targets.map(m=>({x:m.position.x,y:m.position.y}));

					const pattern = [];
					const spacing = 80; 
					let nodeIndex = 0;
					for (let i = 0; i < pts.length - 1; i++){
						const p0 = pts[i];
						const p1 = pts[i+1];

						const dxl = p1.x - p0.x;
						const dyl = p1.y - p0.y;
						const dist = Math.sqrt(dxl*dxl + dyl*dyl);

						const samples = Math.max(2, Math.ceil(dist / spacing));

						const mx = (p0.x+p1.x)/2;
						const my = (p0.y+p1.y)/2;

						const dx = p1.y - p0.y;
						const dy = -(p1.x - p0.x);
						const mag = Math.sqrt(dx*dx + dy*dy) || 1;

						const curveStrength = 0.25;

						const cx = mx + (dx/mag)*120*curveStrength;
						const cy = my + (dy/mag)*120*curveStrength;

						for (let s = 0; s <= samples; s++){
							const t = s / samples;

							const x =
								(1-t)*(1-t)*p0.x +
								2*(1-t)*t*cx +
								t*t*p1.x;

							const y =
								(1-t)*(1-t)*p0.y +
								2*(1-t)*t*cy +
								t*t*p1.y;

							pattern.push({
								x,
								y,
								hit:false,
								state:"waiting",
								timer:0,
								spawnTime: nodeIndex * 2
							});
							nodeIndex++;
						}
					}

					this.technique.pattern = pattern;
					this.technique.targets = targets;
					this.technique.progress = 0;
					t.startCycle = m.cycle;
					t.maxDuration = 30 + pattern.length * 10;
					t.phase = "input";
					t.globalTimer = 0;
					m.energy -= 0.5;
				}
				return;
			}
			if (t.phase === "input") {
				const t = this.technique;
				t.globalTimer++;
				if (m.cycle - t.startCycle > t.maxDuration){
					this.technique.active = false; 
					this.technique.phase = "idle";
					this.shouldSlow = false;
					this.technique.lastKill = 0;
					return;
				} else {
					ctx.beginPath();
					ctx.lineWidth = 3;
					ctx.arc(m.pos.x, m.pos.y, 35, 0, 2 * Math.PI * (m.cycle - t.startCycle) / t.maxDuration);
					ctx.stroke();
				}
				const point = t.pattern[t.progress];
				if (!point) return;
				if (point.state === "spawn" && point.timer > nodeSpawn){
					point.state = "ready";
					point.timer = 0;
				}
				if (point.state === "ready" && point.timer > nodeActive){
					this.technique.active = false;
					this.technique.phase = "idle";
					this.shouldSlow = false;
					return;
				}
				const mx = simulation.mouseInGame.x;
				const my = simulation.mouseInGame.y;
				const lx = t.lastMouseX ?? mx;
				const ly = t.lastMouseY ?? my;
				const vx = mx - lx;
				const vy = my - ly;
				const wx = point.x - lx;
				const wy = point.y - ly;
				const segLenSq = vx*vx + vy*vy;
				let proj = 0;
				if (segLenSq > 0)
					proj = (wx*vx + wy*vy) / segLenSq;
				proj = Math.max(0, Math.min(1, proj));
				const closestX = lx + vx*proj;
				const closestY = ly + vy*proj;
				const dx = closestX - point.x;
				const dy = closestY - point.y;
				if (point.state === "ready" && dx*dx + dy*dy < 40*40){
					point.hit = true;
					t.progress++;
				}
				t.lastMouseX = mx;
				t.lastMouseY = my;
				if (t.progress >= t.pattern.length){
					this.resolveTechnique();
				}
			}
			if (t.phase === "input") {
				const t = this.technique;
				for (let i = 0; i < t.pattern.length; i++) {
					const p = t.pattern[i];
					if(!p) continue;
					if (p.anim === undefined){
						p.anim = 0;
						p.dead = false;
					}
					if (p.hit && !p.dead){
						p.anim += 0.1;
						if (p.anim >= 1){
							p.anim = 1;
							p.dead = true;
						}
					}
					if (p.dead) continue;
					let scale = 1;
					let alpha = 1;
					p.timer++;
					if (p.state === "waiting" && t.globalTimer >= p.spawnTime){
						p.state = "spawn";
						p.timer = 0;
					}
					if (p.state === "spawn"){
						const t = Math.min(1, p.timer / nodeSpawn);
						const k = t*t;
						alpha = k * 0.9;
						scale = 1.6 - k * 0.8;
					}
					if (p.hit){
						scale = 1 + p.anim * 1.8;
						alpha = 1 - p.anim;
					}
					ctx.beginPath();
					ctx.arc(p.x, p.y, 40 * scale, 0, Math.PI * 2);
					if (p.hit){
						ctx.strokeStyle = `rgba(255,0,0,${alpha})`;
						ctx.stroke();
					}
					else if (p.state === "ready"){
						if (i === t.progress){
							ctx.fillStyle = "rgb(255,0,0)";
							ctx.fill();
						} else {
							ctx.strokeStyle = "rgba(255,80,80,0.9)";
							ctx.lineWidth = 3;
							ctx.stroke();
						}
					}
					else if (p.state === "spawn"){
						ctx.strokeStyle = `rgba(255,0,0,${alpha})`;
						ctx.stroke();
					}
				}
			}
		},
		resolveTechnique() {
			const t = this.technique;
			if (!t.targets || !t.targets.length){
				this.technique.active = false; 
				this.technique.phase = "idle";
				this.shouldSlow = false;
				this.technique.lastKill = simulation.cycle;
				return;
			}
			let sumX=0, sumY=0, sumXY=0, sumXX=0;
			const n = t.targets.length;
			for (let m of t.targets){
				const x = m.position.x;
				const y = m.position.y;
				sumX += x;
				sumY += y;
				sumXY += x*y;
				sumXX += x*x;
			}
			const denom = (n*sumXX - sumX*sumX);
			let dirX, dirY, cx, cy;
			if (Math.abs(denom) < 0.0001) {
				cx = sumX/n;
				cy = sumY/n;
				dirX = 0;
				dirY = 1;
			} else {
				const slope = (n*sumXY - sumX*sumY) / denom;
				dirX = 1;
				dirY = slope;
				const len = Math.hypot(dirX,dirY);
				dirX/=len;
				dirY/=len;
				cx = sumX/n;
				cy = sumY/n;
			}
			const L = 10000;
			this.technique.cutLine = {
				x1: cx - dirX*L,
				y1: cy - dirY*L,
				x2: cx + dirX*L,
				y2: cy + dirY*L,
				alpha:1
			};
			for (let m2 of t.targets){
				let oldLeave = m2.leaveBody;
				m2.damage(6 * n);
				Matter.Body.applyForce(m2, m2.position, {
					x: dirX * 0.8,
					y: dirY * 0.8 - 0.4
				});
				if(!m2.alive) {
					m2.leaveBody = false;
					if(oldLeave && m2.mass > 1 && m2.radius > 18) {
						let v = Matter.Vertices.hull(Matter.Vertices.clockwiseSort(m2.vertices)) //might help with vertex collision issue, not sure
						if (v.length < 3) continue;
						const cutPoint = 3 + Math.floor((v.length - 6) * Math.random()) //Math.floor(v.length / 2)
						const v2 = v.slice(0, cutPoint + 1)
						v = v.slice(cutPoint - 1)
						const len = body.length;
						body[len] = Matter.Bodies.fromVertices(m2.position.x, m2.position.y, v2);
						Matter.Body.setVelocity(body[len], Vector.mult(m2.velocity, 0.5));
						Matter.Body.setAngularVelocity(body[len], m2.angularVelocity);
						body[len].collisionFilter.category = cat.body;
						body[len].collisionFilter.mask = cat.player | cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet;
						body[len].classType = "body";
						body[len].frictionAir = 0.001
						body[len].friction = 0.05
						Composite.add(engine.world, body[len]); //add to world

						const len2 = body.length;
						body[len2] = Matter.Bodies.fromVertices(m2.position.x, m2.position.y, v);
						Matter.Body.setVelocity(body[len2], Vector.mult(m2.velocity, 0.5));
						Matter.Body.setAngularVelocity(body[len2], m2.angularVelocity);
						body[len2].collisionFilter.category = cat.body;
						body[len2].collisionFilter.mask = cat.player | cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet;
						body[len2].classType = "body";
						body[len2].frictionAir = 0.001
						body[len2].friction = 0.05
						Composite.add(engine.world, body[len2]); //add to world
						//large mobs shrink so they don't block paths
						if (body[len].mass + body[len2].mass > 16) {
							const massLimit = 8 + 6 * Math.random()
							const shrink = function (that1, that2) {
								if (that1.mass + that2.mass > massLimit) {
									const scale = 0.95;
									Matter.Body.scale(that1, scale, scale);
									Matter.Body.scale(that2, scale, scale);
									setTimeout(shrink, 20, that1, that2);
								}
							};
							shrink(body[len], body[len2])
						}
						
						Matter.Body.applyForce(body[len], body[len].position, {
							x: dirX * 0.02,
							y: dirY * 0.02 - 0.01
						});
						Matter.Body.applyForce(body[len2], body[len2].position, {
							x: dirX * 0.02,
							y: dirY * 0.02 - 0.01
						});
					}
				}
			}
			this.technique.phase="resolve";
			this.technique.active=false;
			this.technique.lastKill = simulation.cycle;
			this.shouldSlow = false;
		},
	};
	b.guns.push(e);
	const gunArray = b.guns.filter(
	(obj, index, self) =>
		index === self.findIndex((item) => item.name === obj.name)
	);
	b.guns = gunArray;
	const t = [
		{
			name: "size-weight illusion",
			descriptionFunction() {
				return `follow your cursor when sword is active<br><b>1.1x</b> <b class="color-d">damage</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("sword") && !tech.isStabSword
			},
			requires: "sword",
			effect() {
				tech.sizeIllusion = true;
			},
			remove() {
				tech.sizeIllusion = false;
			}
		},		
		{
			name: "silicon carbide",
			descriptionFunction() {
				return `crouch hold fire to charge <b>stab</b><br><b>1.5x</b> <b class="color-d">damage</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() { 
				return tech.haveGunCheck("sword") && !tech.sizeIllusion && !tech.infinityEdge & !tech.heavenlyArray
			},
			requires: "sword, not cantor's theorem, not size-weight illusion, not dirac sea",
			effect() {
				tech.isStabSword = true;
			},
			remove() {
				tech.isStabSword = false;
			}
		},
		{
			name: "cantor's theorem",
			descriptionFunction() {
				return `sword size <b>scales</b> by <b class="color-h">health</b><br><b>1.1x</b> <b class="color-d">damage</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() { 
				return tech.haveGunCheck("sword") && !tech.isStabSword && !tech.greatSword && !tech.longSword
			},
			requires: "sword, not silicon carbide",
			effect() {
				tech.infinityEdge = true;
			},
			remove() {
				tech.infinityEdge = false;
			}
		},
		{
			name: "plasmon",
			descriptionFunction() {
				return `increase sword range by <b>3x</b><br><em>plasmon is beyond visible perception</em>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() { 
				return tech.haveGunCheck("sword") && !tech.greatSword && !tech.longSword & !tech.heavenlyArray
			},
			requires: "sword, not greatsword, not longsword, not dirac sea",
			effect() {
				tech.soundSword = true;
			},
			remove() {
				tech.soundSword = false;
			}
		},		
		{
			name: "greatsword",
			descriptionFunction() {
				return `<b>2x</b> sword <b class="color-d">damage</b><br><b>0.75x</b> sword <b class="color-speed">speed</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() { 
				return tech.haveGunCheck("sword") && !tech.infinityEdge && !tech.soundSword && !tech.longSword
			},
			requires: "sword, not plasmon, canton's theorem, not longsword, not plasmon",
			effect() {
				tech.greatSword = true;
			},
			remove() {
				tech.greatSword = false;
				for (let i = 0, len = b.inventory.length; i < len; ++i) {
					if(b.guns[b.inventory[i]].name === "sword" && !m.alive) {
						b.guns[b.inventory[i]].cycle = 0;
						b.guns[b.inventory[i]].haveEphemera = false;
					}
				}
			}
		},		
		{
			name: "longsword",
			descriptionFunction() {
				return `<b>1.7x</b> sword <em>length</em> and <b class="color-d">damage</b><br><b>0.6x</b> swing <b class="color-speed">speed</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() { 
				return tech.haveGunCheck("sword") && !tech.infinityEdge && !tech.soundSword && !tech.greatSword & !tech.heavenlyArray
			},
			requires: "sword, not plasmon, canton's theorem, not greatsword, not dirac sea",
			effect() {
				tech.longSword = true;
			},
			remove() {
				tech.longSword = false;
			}
		},
		{
			name: "dirac sea",
			descriptionFunction() {
				return `sword <b>orbits</b> you while <b>crouching</b> and using sword<br>drains <b class="color-f">energy</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() { 
				return tech.haveGunCheck("sword") && !tech.infinityEdge && !tech.soundSword && !tech.longSword && !tech.isStabSword
			},
			requires: "sword, not plasmon, canton's theorem, not longsword, not silicon carbide",
			effect() {
				tech.heavenlyArray = true;
			},
			remove() {
				tech.heavenlyArray = false;
			}
		},		
		{
			name: "hartman effect",
			descriptionFunction() {
				return `use <b class="color-f">energy</b> to split <b>nearby mobs</b><br><b class="color-d">damage</b> scales with number of <b>mobs</b><em style ="float: right; font-family: monospace;font-size:0.8rem;color:#fff;">↓↓←→</em>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() { 
				return tech.haveGunCheck("sword")
			},
			requires: "sword",
			effect() {
				tech.hartmanEffect = true;
			},
			remove() {
				tech.hartmanEffect = false;
			}
		},
	];
	t.reverse();
	for(let i = 0; i < tech.tech.length; i++) {
		if(tech.tech[i].name === 'spherical harmonics') {
			for(let j = 0; j < t.length; j++) {
				tech.tech.splice(i, 0, t[j]);
			}
			break;
		}
	}
	const techArray = tech.tech.filter(
		(obj, index, self) =>
			index === self.findIndex((item) => item.name === obj.name)
		);
	tech.tech = techArray;
	console.log("%cSword mod successfully installed", "color: crimson");
})();