javascript:(function() {
	checkTwo();
	function isSwordPresent() {
		for (let i = 0; i < simulation.ephemera.length; i++) {
			if (simulation.ephemera[i].name === "sword") {
				return true; 
			}
		}
		return false; 
	}
	function checkTwo() {
		if (!isSwordPresent()) {
			active2();
		}
		requestAnimationFrame(checkTwo);
	}
	const e = {
		name: "sword",
		descriptionFunction() { return `throw a <b>sword</b> that keeps velocity upon collisions<br>drains <strong class='color-h'>health</strong> instead of ammunition<br>doesn't use <b>ammo</b>`},
		ammo: 0,
		ammoPack: Infinity,
		defaultAmmoPack: 15,
		have: false,
		do() {},
		fire() {}
	};
	b.guns.push(e);
	const gunArray = b.guns.filter(
	(obj, index, self) =>
		index === self.findIndex((item) => item.name === obj.name)
	);
	b.guns = gunArray;

	const t = [
		{
			name: "sword tech placeholder",
			descriptionFunction() {
				return `nothing yet!`
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

			},
			remove() {

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
	function active2() {
		simulation.ephemera.push({
			name: "sword",
			cycle: 0,
			sword: undefined,
			bladeSegments: undefined,
			bladeTrails: [],
			angle: 0,
			constraint: undefined,
			do() {
				if (b.activeGun !== null && input.fire && (tech.isEnergyHealth ? m.energy >= 0.11 : m.health >= 0.11)) {
					if (!this.sword && b.guns[b.activeGun].name === 'sword') {
						({ sword: this.sword, bladeSegments: this.bladeSegments} = this.createAndSwingSword());
						this.angle = m.angle;
						if(tech.isEnergyHealth) {
							m.energy -= 0.1;
							if(tech.isPhaseSword) {
								m.immuneCycle = this.cycle;
							}
						} else {
							m.health -= 0.1;
							m.displayHealth();
						}
					}
				}
				if(this.sword && m.cycle > this.cycle + 30) {
					Matter.Body.setAngularVelocity(this.sword, 0);
					Matter.Body.setMass(player, 5)
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
				} else {
					if (this.sword) {
						Matter.Body.setMass(player, 1000)
						// let handle;
						// for(let i = 0; i < bullet.length; i++) {
							// if(bullet[i].customName == "handle") {
								 // handle = bullet[i];
							// }
						// }
						if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
							Matter.Body.setAngularVelocity(this.sword, -Math.PI * 0.1);
						} else {
							Matter.Body.setAngularVelocity(this.sword, Math.PI * 0.1);
						}
						if(!this.constraint) {
							this.constraint = Constraint.create({
								bodyA: player,
								bodyB: this.sword,
								pointB: {x: -10, y: 100},
								// stiffness: 1,
								damping: 0.0001815,
								length: 0,
							});
							Composite.add(engine.world, this.constraint);
						} 
					}
				}
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
				if(this.sword) {
					for (let i = 0; i < mob.length; i++) {
						if (Matter.Query.collides(this.sword, [mob[i]]).length > 0) {
							const dmg = m.dmgScale * 0.12 * 2.73;
							mob[i].damage(dmg, true);
							simulation.drawList.push({
								x: mob[i].position.x,
								y: mob[i].position.y,
								radius: Math.sqrt(dmg) * 50,
								color: simulation.mobDmgColor,
								time: simulation.drawTime
							});
							const angle = Math.atan2(mob[i].position.y - this.sword.position.y, mob[i].position.x - this.sword.position.x);
							this.sword.force.x += Math.cos(angle) * 2;
							this.sword.force.y += Math.sin(angle) * 2;
							break
						}
					}
				}
			},
			createAndSwingSword(x = player.position.x, y = player.position.y, angle = m.angle) {
				if (this.cycle < m.cycle) {
					this.cycle = m.cycle + 60;
					m.fireCDcycle = Infinity;
					const handleWidth = 20;
					const handleHeight = 200;
					const handle = Bodies.rectangle(x, y, handleWidth, handleHeight, spawn.propsIsNotHoldable);
					bullet[bullet.length] = handle;
					// handle.customName = "handle";
					bullet[bullet.length - 1].do = () => {};
					const bladeWidth = 100;
					const bladeHeight = 20;
					const numBlades = 10;
					const extensionFactor = 5.5;
					const bladeSegments = [];
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
						bullet[bullet.length] = blade;
						bullet[bullet.length - 1].do = () => {};
						Matter.Body.rotate(blade, -Math.sin(i * (Math.PI / 270) * 15));
						bladeSegments.push(blade);
					}
					const sword = Body.create({
						parts: [handle, ...bladeSegments],
					});
			
					Composite.add(engine.world, sword);
					Matter.Body.setPosition(sword, {x, y});
			
					sword.collisionFilter.category = cat.bullet;
					sword.collisionFilter.mask = cat.mobBullet | cat.mob;
			
					if ((angle > -Math.PI / 2 && angle < Math.PI / 2)) {
						Body.scale(sword, -1, 1, { x, y });
					}

					sword.frictionAir -= 0.01;
			
					return { sword, bladeSegments };
				}
			},          
		})
	}
	console.log("%cSword mod successfully installed", "color: crimson");
})();
