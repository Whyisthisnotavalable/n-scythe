javascript:(function() {
	const e = {
		name: "scythe",
		descriptionFunction() { return `throw a <b>scythe</b> that keeps velocity upon collisions<br>drains <strong class='color-h'>health</strong> instead of ammunition<br>doesn't use <b>ammo</b>`},
		ammo: Infinity,
		ammoPack: Infinity,
		defaultAmmoPack: Infinity,
		have: false,
		fire() {},
		cycle: 0,
		cycle2: 0,
		scythe: undefined,
		bladeSegments: undefined,
		bladeTrails: [],
		angle: 0,
		constraint: undefined,
		durability: 200,
		maxDurability: 200,
		haveEphemera: false,
		right: true,
		do() {
			if(this.cycle2 === 0) {
				const oldEffect = powerUps.ammo.effect;
				powerUps.ammo.effect = () => {
					oldEffect();
					for (let i = 0, len = b.inventory.length; i < len; ++i) {
						if(b.guns[b.inventory[i]].name === "scythe" && tech.durabilityScythe) {
							b.guns[b.inventory[i]].durability += (tech.isAmmoForGun && b.guns[b.activeGun].name === 'scythe') ? 30 : 15;
						}
					}
				}
			}
			this.cycle2++;
			if(!this.haveEphemera) {
				this.haveEphemera = true;
				simulation.ephemera.push({
					name: "scythe",
					do() {
						if(b.guns[b.activeGun].name !== 'scythe') {
							for (let i = 0, len = b.inventory.length; i < len; ++i) {
								if(b.guns[b.inventory[i]].name === "scythe" && b.guns[b.inventory[i]].scythe) {
									b.guns[b.inventory[i]].cycle = 0;
									if(b.guns[b.inventory[i]].constraint) {
										Composite.remove(engine.world, b.guns[b.inventory[i]].constraint);
										b.guns[b.inventory[i]].constraint = undefined;
									}
									Composite.remove(engine.world, b.guns[b.inventory[i]].scythe);
									b.guns[b.inventory[i]].scythe.parts.forEach(part => {
										Composite.remove(engine.world, part);
										const index = bullet.indexOf(part);
										if (index !== -1) {
											bullet.splice(index, 1);
										}
									});
									b.guns[b.inventory[i]].scythe = undefined;
									b.guns[b.inventory[i]].bladeTrails = [];
								}
							}
						}
						for (let i = 0, len = b.inventory.length; i < len; ++i) {
							if(b.guns[b.inventory[i]].name === "scythe" && tech.durabilityScythe) {
								document.getElementById(b.inventory[i]).innerHTML = `${b.guns[b.inventory[i]].name} - ${b.guns[b.inventory[i]].durability}/${b.guns[b.inventory[i]].maxDurability} <em style="font-size: 20px;">durability</em>`
							}
						}
					},
				})
			}
			if(tech.isAmmoScythe) {
				this.ammoPack = 1;
				this.defaultAmmoPack = 1;
			} else {
				this.ammo = Infinity;
				this.ammoPack = Infinity;
				this.defaultAmmoPack = Infinity;
			}
			this.durability = Math.max(0, Math.min(this.durability, this.maxDurability));
			if (b.activeGun !== null && input.fire && (tech.isEnergyHealth ? m.energy >= 0.11 : m.health >= 0.11) && this.durability > 0) {
				if (!this.scythe && b.guns[b.activeGun].name === 'scythe') {					
					this.angle = m.angle;
					if(tech.durabilityScythe) {
						if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
							this.right = false;
							({ scythe: this.scythe, bladeSegments: this.bladeSegments} = this.createScythe(player.position, false));
						} else {
							this.right = true;
							({ scythe: this.scythe, bladeSegments: this.bladeSegments} = this.createScythe(player.position, true));
						}
					} else {
						({ scythe: this.scythe, bladeSegments: this.bladeSegments} = this.createAndSwingScythe());
					}
					
					if(!tech.isAmmoScythe && !b.guns[b.activeGun].ammo == 0 && !tech.durabilityScythe) {
						if(tech.isEnergyHealth) {
							m.energy -= 0.1;
							if(tech.isPhaseScythe) {
								m.immuneCycle = this.cycle;
							}
						} else {
							m.health -= 0.1;
							m.displayHealth();
						}
					}
				}
			}
			if(tech.durabilityScythe) {
				if (!(m.angle > -Math.PI / 2 && m.angle < Math.PI / 2) && this.right == true && this.scythe) {
					Matter.Body.setAngularVelocity(this.scythe, 0);
					Composite.remove(engine.world, this.scythe);
					this.scythe.parts.forEach(part => {
						Composite.remove(engine.world, part);
						const index = bullet.indexOf(part);
						if (index !== -1) {
							bullet.splice(index, 1);
						}
					});
					this.scythe = undefined;
					this.bladeTrails = [];
					m.fireCDcycle = 0;
					if(this.constraint) {
						Composite.remove(engine.world, this.constraint);
						this.constraint = undefined;
					}
				} else if((m.angle > -Math.PI / 2 && m.angle < Math.PI / 2) && this.right == false && this.scythe) {
					Matter.Body.setAngularVelocity(this.scythe, 0);
					Composite.remove(engine.world, this.scythe);
					this.scythe.parts.forEach(part => {
						Composite.remove(engine.world, part);
						const index = bullet.indexOf(part);
						if (index !== -1) {
							bullet.splice(index, 1);
						}
					});
					this.scythe = undefined;
					this.bladeTrails = [];
					m.fireCDcycle = 0;
					if(this.constraint) {
						Composite.remove(engine.world, this.constraint);
						this.constraint = undefined;
					}
				}
				if(this.scythe && (!input.fire || !this.durability)) {
					Matter.Body.setAngularVelocity(this.scythe, 0);
					Composite.remove(engine.world, this.scythe);
					this.scythe.parts.forEach(part => {
						Composite.remove(engine.world, part);
						const index = bullet.indexOf(part);
						if (index !== -1) {
							bullet.splice(index, 1);
						}
					});
					this.scythe = undefined;
					this.bladeTrails = [];
					m.fireCDcycle = 0;
					if(this.constraint) {
						Composite.remove(engine.world, this.constraint);
						this.constraint = undefined;
					}
				}
			}
			if(this.scythe && m.cycle > this.cycle + 30 && !tech.durabilityScythe) {
				Matter.Body.setAngularVelocity(this.scythe, 0);
				Composite.remove(engine.world, this.scythe);
				this.scythe.parts.forEach(part => {
					Composite.remove(engine.world, part);
					const index = bullet.indexOf(part);
					if (index !== -1) {
						bullet.splice(index, 1);
					}
				});
				this.scythe = undefined;
				this.bladeTrails = [];
				m.fireCDcycle = 0;
				if(this.constraint) {
					Composite.remove(engine.world, this.constraint);
					this.constraint = undefined;
				}
			} else {
				if (this.scythe && !tech.isMeleeScythe && !tech.durabilityScythe) {
					if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
						Matter.Body.setAngularVelocity(this.scythe, -Math.PI * 0.15 - (tech.scytheRad ? tech.scytheRad * 0.1 : 0));
					} else {
						Matter.Body.setAngularVelocity(this.scythe, Math.PI * 0.15 + (tech.scytheRad ? tech.scytheRad * 0.1 : 0));
					}
					Matter.Body.setVelocity(this.scythe, {
						x: Math.cos(this.angle) * 30,
						y: Math.sin(this.angle) * 30
					});
				} else if(this.scythe && (tech.isMeleeScythe || tech.durabilityScythe)) {
					if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
						Matter.Body.setAngularVelocity(this.scythe, -Math.PI * 0.1 + (tech.isStunScythe ? 0.1 : 0) - (tech.scytheRad ? tech.scytheRad * 0.1 : 0));
					} else {
						Matter.Body.setAngularVelocity(this.scythe, Math.PI * 0.1 - (tech.isStunScythe ? 0.1 : 0) + (tech.scytheRad ? tech.scytheRad * 0.1 : 0));
					}
					if(tech.durabilityScythe) {
						if(!this.constraint) {
							if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
								this.constraint = Constraint.create({
									pointA: player.position,
									bodyB: this.scythe,
									pointB: {x: 50, y: 100},
									stiffness: 0.9,
									damping: 0.001
								});
								Composite.add(engine.world, this.constraint);
							} else {
								this.constraint = Constraint.create({
									pointA: player.position,
									bodyB: this.scythe,
									pointB: {x: -50, y: 100},
									stiffness: 0.9,
									damping: 0.001
								});
								Composite.add(engine.world, this.constraint);
							}
						} 
					} else {
						Matter.Body.setPosition(this.scythe, player.position);
					}
				}
			}
			if(this.scythe) {
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
						} else if (tech.isAmmoScythe) {
							ctx.fillStyle = `#c0c0c0${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
						} else if (tech.isStunScythe) {
							ctx.fillStyle = `#4b0082${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
						} else {
							ctx.fillStyle = `rgba(220, 20, 60, ${alpha})`;
						}
						ctx.fill();
					}
				}
				for(let i = 0; i < this.bladeSegments.length; i++) {
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : tech.isAmmoScythe ? "#c0c0c0" : tech.isStunScythe ? "indigo" : "crimson";
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
			if(this.scythe) {
				for (let i = 0; i < mob.length; i++) {
					if (Matter.Query.collides(this.scythe, [mob[i]]).length > 0) {
						if(tech.durabilityScythe) {
							this.durability--;
						}
						const dmg = m.dmgScale * 0.12 * 2.73 * (tech.isLongBlade ? 1.3 : 1) * (tech.scytheRange ? tech.scytheRange * 1.15 : 1) * (tech.isDoubleScythe ? 0.9 : 1) * (tech.scytheRad ? tech.scytheRad * 1.5 : 1);
						mob[i].damage(dmg, true);
						simulation.drawList.push({
							x: mob[i].position.x,
							y: mob[i].position.y,
							radius: Math.sqrt(dmg) * 50,
							color: simulation.mobDmgColor,
							time: simulation.drawTime
						});
						if(!tech.isMeleeScythe) {
							const angle = Math.atan2(mob[i].position.y - this.scythe.position.y, mob[i].position.x - this.scythe.position.x);
							this.scythe.force.x += Math.cos(angle) * 2;
							this.scythe.force.y += Math.sin(angle) * 2;
						}
						if(tech.isStunScythe) {
							mobs.statusStun(mob[i], 90);
						}
						break
					}
				}
			}
		},
		createAndSwingScythe(x = player.position.x, y = player.position.y, angle = m.angle) {
			if (this.cycle < m.cycle) {
				this.cycle = m.cycle + 60 + (tech.scytheRange * 6);
				m.fireCDcycle = Infinity;
				const handleWidth = 20;
				const handleHeight = 200 + (tech.isLongBlade ? 30 : 0) + (tech.isMeleeScythe ? 140 : 0);
				const handle = Bodies.rectangle(x, y, handleWidth, handleHeight, spawn.propsIsNotHoldable);
				bullet[bullet.length] = handle;
				bullet[bullet.length - 1].do = () => {};
				const bladeWidth = 100;
				const bladeHeight = 20;
				const numBlades = 10 + (tech.isLongBlade ? 1 : 0) + (tech.isMeleeScythe ? 2 : 0);
				const extensionFactor = 5.5;
				const bladeSegments = [];
				if(!tech.isDoubleScythe) {
					for (let i = 0; i < numBlades; i++) {
						const extensionFactorFraction = (i / (numBlades - 1)) * extensionFactor;
						const bladeX = x - handleWidth / 2 + i * (bladeWidth / 2) - extensionFactorFraction * (bladeWidth / 2);
						const bladeY = y + handleHeight / 2 - i * (bladeHeight / (3 ** i));
			
						const vertices = [
							{ x: bladeX, y: bladeY - bladeHeight / 2 }, 
							{ x: bladeX + bladeWidth / 2, y: bladeY + bladeHeight / 2 },
							{ x: bladeX - bladeWidth / 2, y: bladeY + bladeHeight / 2 },
							{ x: bladeX, y: bladeY - bladeHeight / 2 + 10 },
						];
			
						const blade = Bodies.fromVertices(bladeX, bladeY, vertices, spawn.propsIsNotHoldable);
						bullet[bullet.length] = blade;
						bullet[bullet.length - 1].do = () => {};
						Matter.Body.rotate(blade, -Math.sin(i * (Math.PI / 180) * 5));
						bladeSegments.push(blade);
					}
				} else {
					for (let i = 0; i < numBlades; i++) {
						const extensionFactorFraction = (i / (numBlades - 1)) * extensionFactor;
						const bladeX = x - handleWidth / 2 + i * (bladeWidth / 2) - extensionFactorFraction * (bladeWidth / 2);
						const bladeY = y + handleHeight / 2 - i * (bladeHeight / (3 ** i));
			
						const vertices = [
							{ x: bladeX, y: bladeY - bladeHeight / 2 }, 
							{ x: bladeX + bladeWidth / 2, y: bladeY + bladeHeight / 2 },
							{ x: bladeX - bladeWidth / 2, y: bladeY + bladeHeight / 2 },
							{ x: bladeX, y: bladeY - bladeHeight / 2 + 10 },
						];
			
						const blade = Bodies.fromVertices(bladeX, bladeY, vertices, spawn.propsIsNotHoldable);
						bullet[bullet.length] = blade;
						bullet[bullet.length - 1].do = () => {};
						Matter.Body.rotate(blade, -Math.sin(i * (Math.PI / 180) * 5));
						bladeSegments.push(blade);
					}

					for (let i = 0; i < numBlades; i++) {
						const extensionFactorFraction = (i / (numBlades - 1)) * extensionFactor;
						const bladeX = x + handleWidth / 2 - i * (bladeWidth / 2) + extensionFactorFraction * (bladeWidth / 2);
						const bladeY = y - handleHeight / 2 - i * (bladeHeight / (3 ** i));
			
						const vertices = [
							{ x: bladeX, y: bladeY - bladeHeight / 2 }, 
							{ x: bladeX + bladeWidth / 2, y: bladeY + bladeHeight / 2 },
							{ x: bladeX - bladeWidth / 2, y: bladeY + bladeHeight / 2 },
							{ x: bladeX, y: bladeY - bladeHeight / 2 + 10 },
						];
			
						const blade = Bodies.fromVertices(bladeX, bladeY, vertices, spawn.propsIsNotHoldable);
						bullet[bullet.length] = blade;
						bullet[bullet.length - 1].do = () => {};
						Matter.Body.rotate(blade, -Math.sin(i * (Math.PI / 180) * 5) + Math.PI);
						bladeSegments.push(blade);
					}
				}
				const scythe = Body.create({
					parts: [handle, ...bladeSegments],
				});
		
				Composite.add(engine.world, scythe);
				Matter.Body.setPosition(scythe, { x, y });
		
				scythe.collisionFilter.category = cat.bullet;
				scythe.collisionFilter.mask = cat.mobBullet | cat.mob;
		
				if ((angle > -Math.PI / 2 && angle < Math.PI / 2)) {
					Body.scale(scythe, -1, 1, { x, y });
				}

				scythe.frictionAir -= 0.01;
		
				return { scythe, bladeSegments };
			}
		},
		createScythe(position = player.position, right = true) {
			let x = position.x;
			let y = position.y;
			const handleWidth = 20;
			const handleHeight = 220;

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
			const handle2Vertices = [
				{ x: x + 120, y: y - 140},
				{ x: x + 100, y: y - 140 },
				{ x: x + 23, y: y },
				{ x: x + 3, y: y },
			];
			const handle2 = Bodies.fromVertices(x + 50, y - handleHeight / 2 - 70, handle2Vertices, spawn.propsIsNotHoldable);
			
			const joint = Bodies.polygon(x + 100, y - handleHeight - 20, 5, 30, spawn.propsIsNotHoldable);	
			
			const joint2 = Bodies.polygon(x, y - handleHeight / 2, 3, 20, spawn.propsIsNotHoldable);
			Body.rotate(joint2, Math.PI / 2)
			
			const blade1Vertices = [
				{ x: x - 5, y: y - 10},
				{ x: x - 15, y: y + 10 },
				{ x: x - 100, y: y - 35},
				{ x: x - 60, y: y},
			];
			const blade1 = Bodies.fromVertices(x + 50, y - handleHeight / 2 - 150, blade1Vertices, spawn.propsIsNotHoldable);
			
			const blade2Vertices = [
				{ x: x - 10, y: y - 10},
				{ x: x + 15, y: y + 10 },
				{ x: x - 100, y: y - 30},
				{ x: x - 60, y: y},
			];
			const blade2 = Bodies.fromVertices(x + 100, y - handleHeight / 2 - 150, blade2Vertices, spawn.propsIsNotHoldable);		
			
			const blade3Vertices = [
				{ x: x - 10, y: y - 10},
				{ x: x + 15, y: y + 10 },
				{ x: x - 90, y: y - 30},
				{ x: x - 60, y: y},
			];
			const blade3 = Bodies.fromVertices(x + 150, y - handleHeight / 2 - 130, blade3Vertices, spawn.propsIsNotHoldable);		
			
			const blade4Vertices = [
				{ x: x, y: y - 10},
				{ x: x + 15, y: y + 10},
				{ x: x - 90, y: y - 25},
				{ x: x - 60, y: y + 5},
			];
			const blade4 = Bodies.fromVertices(x - 20, y - handleHeight / 2 - 160, blade4Vertices, spawn.propsIsNotHoldable);
			
			const blade5Vertices = [
				{ x: x, y: y - 30},
				{ x: x + 15, y: y - 10},
				{ x: x - 90, y: y - 25},
				{ x: x - 60, y: y},
			];
			const blade5 = Bodies.fromVertices(x - 90, y - handleHeight / 2 - 160, blade5Vertices, spawn.propsIsNotHoldable);

			const blade6Vertices = [
				{ x: x + 10, y: y - 15},
				{ x: x + 30, y: y + 4},
				{ x: x - 90, y: y + 10},
				{ x: x - 30, y: y + 20},
			];
			const blade6 = Bodies.fromVertices(x - 150, y - handleHeight / 2 - 150, blade6Vertices, spawn.propsIsNotHoldable);
			
			const scythe = Body.create({
				parts: [handle, handle2, pommel, blade6, blade5, blade4, blade1, blade2, blade3, joint, joint2],
			});

			Composite.add(engine.world, scythe);
			Matter.Body.setPosition(scythe, { 
				x: x, 
				y: y
			});
			Matter.Body.setVelocity(scythe, { 
				x: 0, 
				y: 0
			});
			scythe.collisionFilter.category = cat.bullet;
			scythe.collisionFilter.mask = cat.mobBullet | cat.powerup | cat.mob | cat.body | cat.bullet;
			Body.scale(scythe, -1, 1); //disappears without this >:(
			if(!right) {
				Body.scale(scythe, -1, 1);
			}
			return { scythe, bladeSegments: [handle, handle2, pommel, blade6, blade5, blade4, blade1, blade2, blade3, joint, joint2] };
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
			name: "drawn out",
			link: `<a target="_blank" href='https://en.wikipedia.org/wiki/Forging' class="link">drawn out</a>`,
			descriptionFunction() {
				return `<strong>+1</strong> scythe blade parts<br><strong>1.3x</strong> scythe <strong class="color-d">damage</strong>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("scythe") && !tech.durabilityScythe
			},
			requires: "scythe",
			effect() {
				tech.isLongBlade = true;
			},
			remove() {
				tech.isLongBlade = false;
			}
		},
		{
			name: "Ti-6Al-4V",
			link: `<a target="_blank" href='https://en.wikipedia.org/wiki/Ti-6Al-4V' class="link">Ti-6Al-4V</a>`,
			descriptionFunction() {
				return `<strong>1.1x</strong> scythe <strong>range</strong><br><strong>1.15x</strong> scythe <strong class="color-d">damage</strong>`
			},
			isGunTech: true,
			maxCount: 9,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("scythe") && !tech.isPhaseScythe && !tech.durabilityScythe
			},
			requires: "scythe, not phase transition",
			effect() {
				tech.scytheRange = this.count;
				tech.isScytheRange = true;
			},
			remove() {
				tech.scytheRange = 0;
				tech.isScytheRange = false;
			}
		},
		{
			name: "potential flow",
			descriptionFunction() {
				return `<strong style="color: indigo;">+0.1</strong> scythe <strong style="color: indigo;">rotation radians</strong><br><strong>1.5x</strong> scythe <strong class="color-d">damage</strong>`
			},
			isGunTech: true,
			maxCount: 3,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("scythe") && !tech.isMeleeScythe
			},
			requires: "scythe, not reaping",
			effect() {
				tech.isScytheRad = true;
				tech.scytheRad = this.count;
			},
			remove() {
				tech.isScytheRad = false;
				tech.scytheRad = 0;
			}
		},
		{
			name: "duality",
			descriptionFunction() {
				return `forge <strong>+1</strong> scythe blade<br><strong>0.9x</strong> scythe <strong class="color-d">damage</strong>`
			},
			link: `<a target="_blank" href='https://en.wikipedia.org/wiki/Duality_(mathematics)' class="link">duality</a>`,
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("scythe") && !tech.durabilityScythe
			},
			requires: "scythe",
			effect() {
				tech.isDoubleScythe = true;
			},
			remove() {
				tech.isDoubleScythe = false;
			}
		},
		{
			name: "phase transition",
			descriptionFunction() {
				return `when scythe is <strong>active</strong> become <strong>invulnerable</strong><br>drain <strong class="color-f">energy</strong>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("scythe") && !tech.isScytheRange && tech.isEnergyHealth
			},
			requires: "scythe, mass energy, not Ti-6Al-4V",
			effect() {
				tech.isPhaseScythe = true;
			},
			remove() {
				tech.isPhaseScythe = false;
			}
		},
		{
			name: "titanium nitride",
			descriptionFunction() {
				return `scythe now uses <b>ammo</b> instead of <strong class="color-h">health</strong><br><strong>+24%</strong> <strong class='color-junk'>JUNK</strong> to <strong class='color-m'>tech</strong> pool`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("scythe") && tech.isScytheRange && !tech.durabilityScythe
			},
			requires: "scythe, Ti-6Al-4V",
			effect() {
				tech.isAmmoScythe = true;
				for (let i = 0, len = b.inventory.length; i < len; ++i) {
					if(b.guns[b.inventory[i]].name === "scythe") {
						b.guns[b.inventory[i]].ammo = 17;
					}
				}
				simulation.updateGunHUD();
				this.refundAmount += tech.addJunkTechToPool(0.24);
			},
			refundAmount: 0,
			remove() {
				if (tech.isAmmoScythe) {
					tech.isAmmoScythe = false;
					simulation.updateGunHUD();
				}
				tech.isAmmoScythe = false;
				if (this.count > 0 && this.refundAmount > 0) {
					tech.removeJunkTechFromPool(this.refundAmount);
					this.refundAmount = 0;
				}
			}
		},
		{
			name: "reaping",
			descriptionFunction() {
				return `<strong>+2</strong> scythe blades and <strong>1.7x</strong> handle length<br>scythe is now swung`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("scythe") && tech.isDoubleScythe && !tech.isScytheRad && !tech.durabilityScythe
			},
			requires: "scythe, duality",
			effect() {
				tech.isMeleeScythe = true;
			},
			remove() {
				tech.isMeleeScythe = false;
			}
		},
		{
			name: "neurotoxin",
			descriptionFunction() {
				return `scythe <strong>stuns</strong> mobs for 1.5 seconds<br><strong style="color: indigo;">-0.1</strong> scythe <strong style="color: indigo;">rotation radians</strong>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("scythe") && (tech.isDoubleScythe && tech.isMeleeScythe) || tech.durabilityScythe
			},
			requires: "scythe, reaping",
			effect() {
				tech.isStunScythe = true;
			},
			remove() {
				tech.isStunScythe = false;
			}
		},		
		{
			name: "genetic drift",
			descriptionFunction() {
				return `<b>scythe</b> no longer drains <b class="color-h">health</b> and swung<br>scythe has <em>durability</em> and is <b>slightly longer</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("scythe") && !tech.isAmmoScythe && !tech.isMeleeScythe && !tech.scytheRange && !tech.isLongBlade && !tech.isDoubleScythe
			},
			requires: "scythe",
			effect() {
				tech.durabilityScythe = true;
			},
			remove() {
				tech.durabilityScythe = false;
				for (let i = 0, len = b.inventory.length; i < len; ++i) {
					if(b.guns[b.inventory[i]].name === "scythe" && b.guns[b.inventory[i]].maxDurability > 200) {
						b.guns[b.inventory[i]].maxDurability -= 100;
					} else {
						if(b.guns[b.inventory[i]].name === "scythe" && !m.alive) {
							b.guns[b.inventory[i]].cycle = 0;
							b.guns[b.inventory[i]].haveEphemera = false;
							b.guns[b.inventory[i]].durability = 200;
							b.guns[b.inventory[i]].maxDurability = 200;
						}
					}
				}
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
	console.log("%cscythe mod successfully installed", "color: crimson");
})();
