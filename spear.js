javascript:(function() {
	const e = {
		name: "spear",
		descriptionFunction() { return `control a <b>spear</b> that has <em style="color: gray;">durability</em><br>spear is <b>controlled</b> by <b>cursor</b><br><strong>${tech.isAmmoForGun ? 30 - (tech.tempering ? tech.tempering : 0) : 15 - (tech.tempering ? tech.tempering : 0)}</strong> </em style="color: gray;">durability</em> per ${powerUps.orb.ammo()}`},
		ammo: Infinity,
		ammoPack: Infinity,
		defaultAmmoPack: Infinity,
        have: false,
        orbitals: [],
		bladeSegments: undefined,
		bladeTrails: [],
		spear: undefined,
		angle: undefined,
		constraint1: undefined,
		constraint2: undefined,
		cycle: 0,
		durability: 300,
		maxDurability: 300,
		haveEphemera: false,
		fire() {},
		do() {
			let spear = this.spear;
			let durability = this.durability;
			let maxDurability = this.maxDurability;
			if(!this.haveEphemera) {
				this.haveEphemera = true;
				simulation.ephemera.push({
					name: "spear",
					do() {
						if(b.guns[b.activeGun].name !== 'spear') {
							for (let i = 0, len = b.inventory.length; i < len; ++i) {
								if(b.guns[b.inventory[i]].name === "spear" && b.guns[b.inventory[i]].spear) {
									b.guns[b.inventory[i]].cycle = 0;
									if(b.guns[b.inventory[i]].constraint1) {
										Composite.remove(engine.world, b.guns[b.inventory[i]].constraint1);
										b.guns[b.inventory[i]].constraint1 = undefined;
									}
									if(b.guns[b.inventory[i]].constraint2) {
										Composite.remove(engine.world, b.guns[b.inventory[i]].constraint2);
										b.guns[b.inventory[i]].constraint2 = undefined;
									}
									Composite.remove(engine.world, b.guns[b.inventory[i]].spear);
									b.guns[b.inventory[i]].spear.parts.forEach(part => {
										Composite.remove(engine.world, part);
										const index = bullet.indexOf(part);
										if (index !== -1) {
											bullet.splice(index, 1);
										}
									});
									b.guns[b.inventory[i]].spear = undefined;
									b.guns[b.inventory[i]].bladeTrails = [];
								}
							}
						}
						for (let i = 0, len = b.inventory.length; i < len; ++i) {
							if(b.guns[b.inventory[i]].name === "spear") {
								document.getElementById(b.inventory[i]).innerHTML = `${b.guns[b.inventory[i]].name} - ${b.guns[b.inventory[i]].durability}/${b.guns[b.inventory[i]].maxDurability} <em style="font-size: 20px;">durability</em>`
							}
						}
					},
				})
			}
			if(this.cycle === 0) {
				const oldEffect = powerUps.ammo.effect;
				powerUps.ammo.effect = () => {
					oldEffect;
					for (let i = 0, len = b.inventory.length; i < len; ++i) {
						if(b.guns[b.inventory[i]].name === "spear") {
							b.guns[b.inventory[i]].durability += (tech.isAmmoForGun && b.guns[b.activeGun].name === 'spear') ? 30 - (tech.tempering ? tech.tempering : 0): 15 - (tech.tempering ? tech.tempering : 0);
						}
					}
				}
			}
			this.cycle++;
			this.durability = Math.min(this.maxDurability, Math.max(0, this.durability));
			for (let i = 0, len = b.inventory.length; i < len; ++i) {
				if(b.guns[b.inventory[i]].name === "spear") {
					document.getElementById(b.inventory[i]).innerHTML = `${b.guns[b.inventory[i]].name} - ${this.durability}/${this.maxDurability} <em style="font-size: 20px;">durability</em>`
				}
			}
			if (input.fire && (tech.isEnergyHealth ? m.energy >= 0.11 : m.health >= 0.11) && this.durability > 0 && m.fireCDcycle < m.cycle) {
				if (!this.spear && b.guns[b.activeGun].name === 'spear') {
					({ spear: this.spear, bladeSegments: this.bladeSegments} = this.createSpear(player.position));
					this.angle = m.angle;
				}
			}
			if(this.spear) {
				// Matter.Body.setVelocity(this.spear, {x: this.spear.velocity.x * 0.99, y: this.spear.velocity.y * 0.99})
				if(!this.constraint1) {
					this.constraint1 = Constraint.create({
						pointA: player.position,
						bodyB: this.spear,
						pointB: {x: Math.cos(m.angle) * -100, y: Math.sin(m.angle) * -100},
						stiffness: 0.1,
						damping: 0.0000001815,
						length: 0,
						
					});
					Composite.add(engine.world, this.constraint1);
				}
				if(!this.constraint2) {
					this.constraint2 = Constraint.create({
						pointA: simulation.mouseInGame,
						bodyB: this.spear,
						pointB: {x: Math.cos(m.angle) * 100, y: Math.sin(m.angle) * 100},
						stiffness: 0.1,
						damping: 0.0000001815,
						length: 0,
						
					});
					Composite.add(engine.world, this.constraint2);
				}
			}
			if(this.spear && !input.fire) {
				this.cycle = 0;
				if(this.constraint1) {
					Composite.remove(engine.world, this.constraint1);
					this.constraint1 = undefined;
				}
				if(this.constraint2) {
					Composite.remove(engine.world, this.constraint2);
					this.constraint2 = undefined;
				}
				Composite.remove(engine.world, this.spear);
				this.spear.parts.forEach(part => {
					Composite.remove(engine.world, part);
					const index = bullet.indexOf(part);
					if (index !== -1) {
						bullet.splice(index, 1);
					}
				});
				this.spear = undefined;
				this.bladeTrails = [];
				m.fireCDcycle = m.cycle + 10;
			}
			this.collision();
			//this.drawDurability();
			if(tech.shockSpear) {
				this.renderLightning();
				if(this.spear) {
					m.energy -= 0.001;
				}
			} else {
				this.renderDefault();
			}
			if(tech.spearArc && this.spear) {
				const dmg = 0.0001 * m.dmgScale;
				const arcList = [];
				const damageRadius = 1000;
				const dischargeRange = 1700;
				for (let i = 0, len = mob.length; i < len; i++) {
					if (mob[i].alive && (!mob[i].isBadTarget || mob[i].isMobBullet) && !mob[i].isInvulnerable) {
						const sub = Vector.magnitude(Vector.sub(this.spear.position, mob[i].position))
						if (sub < damageRadius + mob[i].radius) {
							arcList.push(mob[i]);
							Matter.Body.setVelocity(mob[i], {x: mob[i].velocity.x * 0.95, y:  mob[i].velocity.y * 0.95})
						}
					}
				}
				for (let i = 0; i < arcList.length; i++) {
					if (tech.spearArc * 0.1 > Math.random()) {
						const who = arcList[Math.floor(Math.random() * arcList.length)]
						who.damage(dmg * 4);
						const sub = Vector.sub(who.position, this.spear.position)
						const unit = Vector.normalise(sub)
						let len = 12
						const step = Vector.magnitude(sub) / (len + 2)
						let x = this.spear.position.x
						let y = this.spear.position.y
						ctx.beginPath();
						ctx.moveTo(x, y);
						for (let i = 0; i < len; i++) {
							x += step * (unit.x + (Math.random() - 0.5))
							y += step * (unit.y + (Math.random() - 0.5))
							ctx.lineTo(x, y);
						}
						ctx.lineTo(who.position.x, who.position.y);
						ctx.strokeStyle = "rgb(220, 20, 220)";
						ctx.lineWidth = 4 + 3 * Math.random();
						ctx.stroke();
					}
				}
			}
        },
		createSpear(position) {
			let x = position.x;
			let y = position.y;
			let angle = m.angle;
			const handleWidth = 20;
			const handleHeight = 500;

			// Handle setup
			const handle = Bodies.rectangle(x, y, handleWidth, handleHeight, spawn.propsIsNotHoldable);
			bullet[bullet.length] = handle;
			handle.customName = "handle";
			bullet[bullet.length - 1].do = () => {};

			// Pommel setup
			const pommelWidth = 30;
			const pommelHeight = 40;
			const pommelVertices = [
				{ x: x, y: y + handleHeight / 2 + pommelHeight / 2 },
				{ x: x + pommelWidth / 2, y: y + handleHeight / 2 },
				{ x: x, y: y + handleHeight / 2 - pommelHeight / 2 },
				{ x: x - pommelWidth / 2, y: y + handleHeight / 2 },
			];
			const pommel = Bodies.fromVertices(x, y + handleHeight / 2, pommelVertices, spawn.propsIsNotHoldable);
			bullet[bullet.length] = pommel;
			bullet[bullet.length - 1].do = () => {};

			const prongWidth = 20;
			const prongHeight = 300;
			const prongOffsetX = 30;

			const leftOuterProngVertices = [
				{ x: x - prongOffsetX, y: y - handleHeight / 2 - prongHeight },
				{ x: x - prongOffsetX - prongWidth, y: y - handleHeight / 2 - prongHeight / 2 },
				{ x: x - prongOffsetX - prongWidth, y: y - handleHeight / 2 },
				{ x: x - prongOffsetX, y: y - handleHeight / 2 - prongHeight / 10},
			];
			const leftOuterProng = Bodies.fromVertices(x - prongOffsetX, y - handleHeight / 2, leftOuterProngVertices, spawn.propsIsNotHoldable);
			bullet[bullet.length] = leftOuterProng;
			bullet[bullet.length - 1].do = () => {};

			const leftInnerProngVertices = [
				{ x: x - prongOffsetX / 2, y: y - handleHeight / 2 - prongHeight / 1.5 },
				{ x: x - prongOffsetX / 2 - prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
				{ x: x - prongOffsetX / 2 + prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
			];
			const leftInnerProng = Bodies.fromVertices(x - prongOffsetX / 2, y - handleHeight / 2, leftInnerProngVertices, spawn.propsIsNotHoldable);
			bullet[bullet.length] = leftInnerProng;
			bullet[bullet.length - 1].do = () => {};

			const rightOuterProngVertices = [
				{ x: x + prongOffsetX, y: y - handleHeight / 2 - prongHeight },
				{ x: x + prongOffsetX + prongWidth, y: y - handleHeight / 2 - prongHeight / 2 },
				{ x: x + prongOffsetX + prongWidth, y: y - handleHeight / 2 },
				{ x: x + prongOffsetX, y: y - handleHeight / 2  - prongHeight / 10},
			];
			const rightOuterProng = Bodies.fromVertices(x + prongOffsetX, y - handleHeight / 2, rightOuterProngVertices, spawn.propsIsNotHoldable);
			bullet[bullet.length] = rightOuterProng;
			bullet[bullet.length - 1].do = () => {};

			const rightInnerProngVertices = [
				{ x: x + prongOffsetX / 2, y: y - handleHeight / 2 - prongHeight / 1.5 },
				{ x: x + prongOffsetX / 2 - prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
				{ x: x + prongOffsetX / 2 + prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
			];
			const rightInnerProng = Bodies.fromVertices(x + prongOffsetX / 2, y - handleHeight / 2, rightInnerProngVertices, spawn.propsIsNotHoldable);
			bullet[bullet.length] = rightInnerProng;
			bullet[bullet.length - 1].do = () => {};

			const middleSmallProngVertices = [
				{ x: x, y: y - handleHeight / 2 - prongHeight / 2 },
				{ x: x - prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
				{ x: x + prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
			];
			const middleSmallProng = Bodies.fromVertices(x, y - handleHeight / 2, middleSmallProngVertices, spawn.propsIsNotHoldable);
			bullet[bullet.length] = middleSmallProng;
			bullet[bullet.length - 1].do = () => {};

			const spear = Body.create({
				parts: [handle, pommel, leftOuterProng, leftInnerProng, rightOuterProng, rightInnerProng, middleSmallProng],
			});

			Composite.add(engine.world, spear);
			Matter.Body.setAngle(spear, -m.angle - Math.PI / 2);
			Matter.Body.setPosition(spear, { 
				x: x, 
				y: y
			});
			Matter.Body.setVelocity(spear, { 
				x: 0, 
				y: 0
			});
			spear.collisionFilter.category = cat.bullet;
			spear.collisionFilter.mask = cat.mobBullet | cat.powerup | cat.mob | cat.body;
			Body.scale(spear, -1, 1, { x, y });

			return { spear, bladeSegments: [leftOuterProng, leftInnerProng, rightOuterProng, rightInnerProng, middleSmallProng, pommel] };
        },
		renderDefault() {
			if(this.spear) {
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
				for(let i = 0; i < this.bladeSegments.length; i++) {
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : "crimson";
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
		},
		renderLightning() {
			if(this.spear) {
				let shock = 20;
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
						ctx.lineWidth = 3;
						ctx.beginPath();
						ctx.moveTo(vertices[0].x + shock * Math.random() - shock * Math.random(), vertices[0].y + shock * Math.random() - shock * Math.random());
						for (let k = 1; k < vertices.length; k++) {
							ctx.lineTo(vertices[k].x + shock * Math.random() - shock * Math.random(), vertices[k].y + shock * Math.random() - shock * Math.random());
						};
						alpha += alphaStep;
						ctx.closePath();
						if(tech.isEnergyHealth) {
							const eyeColor = m.fieldMeterColor;    
							const r = eyeColor[1];
							const g = eyeColor[2];
							const b = eyeColor[3];
							const color = `#${r}${r}${g}${g}${b}${b}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
							ctx.strokeStyle = color;
							ctx.fillStyle = `rgba(250, 250, 250, ${alpha})`;
						} else {
							ctx.strokeStyle = `rgba(220, 20, 220, ${alpha})`;
							ctx.fillStyle = `rgba(250, 250, 250, ${alpha})`;
						}
						ctx.fill();
						ctx.stroke();
					}
				}
				for(let i = 0; i < this.bladeSegments.length; i++) {
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : "rgb(220, 20, 220)";
					ctx.lineWidth = 10;
					ctx.fillStyle = "white";
					ctx.moveTo(this.bladeSegments[i].vertices[0].x + shock * Math.random() - shock * Math.random(), this.bladeSegments[i].vertices[0].y + shock * Math.random() - shock * Math.random());
					for(let j = 0; j < this.bladeSegments[i].vertices.length; j++) {
						ctx.lineTo(this.bladeSegments[i].vertices[j].x + shock * Math.random() - shock * Math.random(), this.bladeSegments[i].vertices[j].y + shock * Math.random() - shock * Math.random())
					};
					ctx.closePath();
					ctx.stroke();
					ctx.fill();
					ctx.lineJoin = "round";
					ctx.miterLimit = 10;
				}
				for(let i = 0; i < this.bladeSegments.length - 1; i++) {
					this.lightning(this.bladeSegments[i].position.x, this.bladeSegments[i].position.y, this.bladeSegments[i + 1].position.x, this.bladeSegments[i + 1].position.y)
				}
			}
		},
		lightning(x1, y1, x2, y2, strokeColor = 'rgb(220, 20, 220)', lineWidth = 5) {
			ctx.strokeStyle = strokeColor;
			ctx.lineWidth = lineWidth;
			const dx = x2 - x1;
			const dy = y2 - y1;
			const distance = Math.sqrt(dx * dx + dy * dy);
			const angle = Math.atan2(dy, dx);
			const boltCount = Math.floor(Math.random() * 3) + 1;
			for (let i = 0; i < boltCount; i++) {
				let currentX = x1;
				let currentY = y1;
				ctx.beginPath();
				ctx.moveTo(currentX, currentY);
				while (Math.hypot(currentX - x1, currentY - y1) < distance) {
					const segmentLength = Math.random() * 10 + 5;
					const offsetAngle = angle + (Math.random() - 0.5) * 0.4;
					const nextX = currentX + Math.cos(offsetAngle) * segmentLength;
					const nextY = currentY + Math.sin(offsetAngle) * segmentLength;
					if (Math.hypot(nextX - x1, nextY - y1) >= distance) break;
					ctx.lineTo(nextX, nextY);
					currentX = nextX;
					currentY = nextY;
				}
				ctx.lineTo(x2, y2);
				ctx.stroke();
			}
		},
		collision() {
			if(this.spear) {
				for (let i = 0; i < mob.length; i++) {
					if (Matter.Query.collides(this.spear, [mob[i]]).length > 0) {
						const dmg = Math.sqrt(m.dmgScale * Math.sqrt(this.spear.speed));
						mob[i].damage(dmg, true);
						simulation.drawList.push({
							x: mob[i].position.x,
							y: mob[i].position.y,
							radius: Math.abs(Math.log(dmg * this.spear.speed) * 40 * mob[i].damageReduction + 3),
							color: simulation.mobDmgColor,
							time: simulation.drawTime
						});
						if(tech.shockSpear) {
							mobs.statusStun(mob[i], 10);
						}
						if(this.durability > 0) {
							this.durability--;
						}
						break
					}
				}
			}
		},
		drawDurability(bgColor = "rgba(0, 0, 0, 0.4)") {
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.strokeStyle = bgColor;
			ctx.arc(m.pos.x, m.pos.y, 35, 0, 2 * Math.PI);
			ctx.stroke();
			
			ctx.beginPath();
			ctx.strokeStyle = "#467";
			ctx.arc(m.pos.x, m.pos.y, 35, 0, 2 * Math.PI * (this.durability / this.maxDurability));
			ctx.stroke();
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
			name: "protoporphyrin IX",
			descriptionFunction() {
				return `<b class="color-h">health</b> is converted to <b>spear</b> <em>durability</em><br>when spear <em>durability</em> reaches 0`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear")
			},
			requires: "spear",
			effect() {
				tech.protoporphyrin = true;
				simulation.ephemera.push({
					name: "healthSpear",
					do() {
						for (let i = 0, len = b.inventory.length; i < len; ++i) {
							if(b.guns[b.inventory[i]].name === "spear" && b.guns[b.inventory[i]].durability == 0) {
								if(tech.isEnergyHealth) {
									m.energy -= 0.01;
									b.guns[b.inventory[i]].durability += 10;
								} else {
									m.health -= 0.01;
									b.guns[b.inventory[i]].durability += 10;
									m.displayHealth();
								}
							}
						}
					}
				})
			},
			remove() {
				tech.protoporphyrin = false;
				simulation.removeEphemera("healthSpear");
			}
		},		
		{
			name: "tempering",
			descriptionFunction() {
				return `+100 spear <em>durability</em><br>-1 <em>durability</em> per ${powerUps.orb.ammo()}`
			},
			isGunTech: true,
			maxCount: 9,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear")
			},
			requires: "spear",
			effect() {
				tech.tempering = this.count;
				for (let i = 0, len = b.inventory.length; i < len; ++i) {
					if(b.guns[b.inventory[i]].name === "spear") {
						b.guns[b.inventory[i]].maxDurability += 100;
					}
				}
			},
			remove() {
				tech.tempering = this.count;
				for (let i = 0, len = b.inventory.length; i < len; ++i) {
					if(b.guns[b.inventory[i]].name === "spear") {
						b.guns[b.inventory[i]].maxDurability -= 100;
					}
				}
			}
		},
		{
			name: "dry lightning",
			descriptionFunction() {
				return `imbue <b>spear</b> with <b style="color: rgb(220, 20, 220);">energy</b><br>mobs are <b class="color-s">stunned</b> by <b>spear</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear")
			},
			requires: "spear",
			effect() {
				tech.shockSpear = true;
			},
			remove() {
				tech.shockSpear = false;
			}
		},		
		{
			name: "arc discharge",
			descriptionFunction() {
				return `spear <b style="color: rgb(220, 20, 220);">lightning</b> may strike nearby mobs<br>increases <b style="color-d">damage</b> and <b style="color: rgb(220, 20, 220);">energy</b> cost`
			},
			isGunTech: true,
			maxCount: 9,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear") && tech.shockSpear
			},
			requires: "spear",
			effect() {
				tech.spearArc = this.count;
			},
			remove() {
				tech.spearArc = this.count;
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
	tech.tech.push()
	const techArray = tech.tech.filter(
		(obj, index, self) =>
			index === self.findIndex((item) => item.name === obj.name)
		);
	tech.tech = techArray;
	console.log("%cSpear mod successfully installed", "color: crimson");
})();