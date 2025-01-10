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
		fire() { },
		do() {
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
			this.collision();
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
				if (this.sword && (tech.isEnergyHealth ? m.energy >= 0.11 : m.health >= 0.11)) {
					if(tech.infinityEdge) {
						const newSize = Math.sqrt(0.5 * m.health) + 1;
						Matter.Body.scale(this.sword, newSize * (1 / (this.sword.scale == undefined ? 1 : this.sword.scale)), newSize * (1 / (this.sword.scale == undefined ? 1 : this.sword.scale)), handle.position);
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
			if(this.constraint) {
				this.constraint.pointA = player.position;
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
						Matter.Body.scale(this.sword, newSize * (1 / (this.sword.scale == undefined ? 1 : this.sword.scale)), newSize * (1 / (this.sword.scale == undefined ? 1 : this.sword.scale)), handle.position);
						this.sword.scale = newSize;
					}
					if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
						Matter.Body.setAngularVelocity(this.sword, -Math.PI * 0.1 * (tech.greatSword ? 0.75 : 1) * (tech.longSword ? 0.6 : 1));
					} else {
						Matter.Body.setAngularVelocity(this.sword, Math.PI * 0.1 * (tech.greatSword ? 0.75 : 1) * (tech.longSword ? 0.6 : 1));
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
			bullet[bullet.length] = handle;
			handle.customName = "handle";
			bullet[bullet.length - 1].do = () => {};
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
			bullet[bullet.length] = leftOuter;
			bullet[bullet.length - 1].do = () => {};
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
			return { sword, bladeSegments: [rightOuter, rightHigher, decor1, decor4, leftOuter, decor2, decor3, leftHigher, decor5, decor6, pommel, cross, cross2] };
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
		collision() {
			if(this.sword) {
				for (let i = 0; i < mob.length; i++) {
					if (Matter.Query.collides(this.sword, [mob[i]]).length > 0) {
						const dmg = m.dmgScale * Math.sqrt(this.sword.speed) * (tech.sizeIllusion ? 1.1 : 1) * (tech.isStabSword ? 1.5 : 1) * (tech.infinityEdge ? 1.1 : 1) * (tech.greatSword ? 2 : 1) * (tech.longSword ? 1.7 : 1);
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
		}
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
				return tech.haveGunCheck("sword") && !tech.sizeIllusion && !tech.infinityEdge
			},
			requires: "sword, not cantor's theorem, not size-weight illusion",
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
				return tech.haveGunCheck("sword") && !tech.greatSword && !tech.longSword
			},
			requires: "sword, not greatsword, longsword",
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
			requires: "sword, not plasmon, canton's theorem",
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
				return tech.haveGunCheck("sword") && !tech.infinityEdge && !tech.soundSword && !tech.greatSword
			},
			requires: "sword, not plasmon, canton's theorem",
			effect() {
				tech.longSword = true;
			},
			remove() {
				tech.longSword = false;
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
