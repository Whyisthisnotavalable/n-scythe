javascript:(function() {
	const e = {
		name: "tachyonic field",
		description: `use <b class="color-f">energy</b> to gain a <b>burst</b> of <b>speed</b><br>multiply <b>momentum</b> <b>exponetially</b><br>16 <b class="color-f">energy</b> per second`,
		canMove: false,
		haveEphemera: false,
		effect() {
			m.fieldMeterColor = "rgb(220, 20, 60)";
			m.eyeFillColor = m.fieldMeterColor;
			m.fillColor = m.fieldMeterColor;
			m.fieldRegen = 0.002667;
			m.energy += m.fieldRegen;
			m.color = {
				hue: 0,
				sat: 5,
				light: 100,
			}
			m.setFillColors();
			m.draw = function () {
				ctx.fillStyle = m.fillColor;
				m.walk_cycle += m.flipLegs * m.Vx;
				ctx.save();
				ctx.globalAlpha = (m.immuneCycle < m.cycle) ? 1 : 0.5 //|| (m.cycle % 40 > 20)
				ctx.translate(m.pos.x, m.pos.y);
				m.calcLeg(Math.PI, -3);
				m.drawLeg("#4a0a0a");
				m.calcLeg(0, 0);
				m.drawLeg("#301");
				ctx.rotate(m.angle);
				ctx.beginPath();
				ctx.arc(0, 0, 30, 0, 2 * Math.PI);
				ctx.fillStyle = m.bodyGradient
				ctx.fill();
				ctx.arc(15, 0, 4, 0, 2 * Math.PI);
				ctx.moveTo(9, -6);
				ctx.arc(5, -6, 4, 0, 2 * Math.PI);
				ctx.moveTo(9, 6);
				ctx.arc(5, 6, 4, 0, 2 * Math.PI);
				ctx.strokeStyle = "#301";
				ctx.lineWidth = 2;
				ctx.stroke();
				ctx.restore();
				m.yOff = m.yOff * 0.85 + m.yOffGoal * 0.15; //smoothly move leg height towards height goal
				powerUps.boost.draw()
			}
			m.drawLeg = function (stroke) {
				// if (simulation.mouseInGame.x > m.pos.x) {
				if (m.angle > -Math.PI / 2 && m.angle < Math.PI / 2) {
					m.flipLegs = 1;
				} else {
					m.flipLegs = -1;
				}
				ctx.save();
				ctx.scale(m.flipLegs, 1); //leg lines
				ctx.beginPath();
				ctx.moveTo(m.hip.x, m.hip.y);
				ctx.lineTo(m.knee.x, m.knee.y);
				ctx.lineTo(m.foot.x, m.foot.y);
				ctx.strokeStyle = stroke;
				ctx.lineWidth = 5;
				ctx.stroke();

				//toe lines
				ctx.beginPath();
				ctx.moveTo(m.foot.x, m.foot.y);
				if (m.onGround) {
					ctx.lineTo(m.foot.x - 14, m.foot.y + 5);
					ctx.moveTo(m.foot.x, m.foot.y);
					ctx.lineTo(m.foot.x + 14, m.foot.y + 5);
				} else {
					ctx.lineTo(m.foot.x - 12, m.foot.y + 8);
					ctx.moveTo(m.foot.x, m.foot.y);
					ctx.lineTo(m.foot.x + 12, m.foot.y + 8);
				}
				ctx.lineWidth = 4;
				ctx.stroke();

				//hip joint
				ctx.beginPath();
				ctx.arc(m.hip.x, m.hip.y, 9, 0, 2 * Math.PI);
				//knee joint
				ctx.moveTo(m.knee.x + 5, m.knee.y);
				ctx.arc(m.knee.x, m.knee.y, 5, 0, 2 * Math.PI);
				//foot joint
				ctx.moveTo(m.foot.x + 4, m.foot.y + 1);
				ctx.arc(m.foot.x, m.foot.y + 1, 4, 0, 2 * Math.PI);
				ctx.fillStyle = m.fillColor;
				ctx.fill();
				ctx.lineWidth = 2;
				ctx.stroke();
				ctx.restore();
			}
			m.hold = () => {
				m.hardLandCDScale = 0.5;
				m.hardLanding = 16000;
				m.isAltSkin = true;
				const dist = Vector.sub(simulation.mouseInGame, player.position);
				const distMag = Vector.magnitude(dist);
				const radius = 400;
				if (distMag < radius || m.isHolding) {
					this.canMove = false;
				} else {
					this.canMove = true;
				}
				ctx.beginPath();
				ctx.moveTo(player.position.x + radius, player.position.y);
				ctx.lineWidth = 2;
				// ctx.setLineDash([Math.PI * 200 + Math.sin(simulation.cycle / 200) * Math.PI * 200, Math.PI * 200 - Math.sin(simulation.cycle / 200) * Math.PI * 200]); //cool, but not necessary
				ctx.arc(player.position.x, player.position.y, radius, 0, 2 * Math.PI);
				ctx.strokeStyle = "#909090";
				ctx.fillStyle = !this.canMove ? "rgba(220, 20, 60, 0.05)" : "transparent";
				ctx.stroke();
				ctx.fill();
				// ctx.setLineDash([]);
				ctx.textAlign = "center";
				ctx.fillStyle = !this.canMove ? "rgba(220, 20, 60, 0.02)" : "transparent";
				ctx.font = "lighter 800px serif";
				ctx.fillText("⚠", player.position.x, player.position.y + 200);

				// m.energy = Math.max(0, Math.min(m.maxEnergy, m.energy));
				
				if (input.field && m.fieldCDcycle < m.cycle && this.canMove && m.energy > 0.2 && (player.velocity.x || player.velocity.y) && !this.haveEphemera) {
					this.haveEphemera = true;
					simulation.ephemera.push({
						name: "speedBoost",
						oldPosition: { x: player.position.x, y: player.position.y },
						drain: 0.02,
						do() {
							if(m.energy > 0.1 && input.field) {
								Matter.Body.setVelocity(player, {x: player.velocity.x * 1.08, y: player.velocity.y * 1.08});
								m.energy -= this.drain;
								// this.lightning((m.pos.x + this.oldPosition.x) / 2, (m.pos.y + this.oldPosition.y) / 2, m.pos.x + Math.random() * 20 - Math.random() * 20, m.pos.y + Math.random() * 20 - Math.random() * 20, "rgb(220, 20, 60)", 3);
								this.drawLightningArc(m.pos, 50);
								simulation.drawList.push({
									x: player.position.x + Math.random() * 20 - Math.random() * 20,
									y: player.position.y + Math.random() * 20 - Math.random() * 20,
									radius: 15,
									color: "rgba(220,20,60,0.4)",
									time: 15
								});
								if(!(simulation.cycle % 100)) {
									this.oldPosition = {x: (m.pos.x + this.oldPosition.x) / 2, y: (m.pos.y + this.oldPosition.y) / 2};
								}
							} else {
								for(let i = 0; i < m.fieldUpgrades.length; i++) {
									if(m.fieldUpgrades[i].name === "tachyonic field") {
										m.fieldUpgrades[i].haveEphemera = false;
									}
								}
								simulation.removeEphemera(this.name);
							}
						},
						// lightning(x1, y1, x2, y2, strokeColor = 'rgba(220, 20, 60, 0.5)', lineWidth = 5) {
							// ctx.strokeStyle = strokeColor;
							// ctx.lineWidth = lineWidth;
							// const dx = x2 - x1;
							// const dy = y2 - y1;
							// const distance = Math.sqrt(dx * dx + dy * dy);
							// const angle = Math.atan2(dy, dx);
							// const boltCount = Math.floor(Math.random() * 3) + 1;
							// let currentX = x1;
							// let currentY = y1;
							// ctx.beginPath();
							// ctx.moveTo(currentX, currentY);
							// while (Math.hypot(currentX - x1, currentY - y1) < distance) {
								// const segmentLength = Math.random() * 10 + 10;
								// const offsetAngle = angle + (Math.random() - 0.5) * 0.4;
								// const nextX = currentX + Math.cos(offsetAngle) * segmentLength;
								// const nextY = currentY + Math.sin(offsetAngle) * segmentLength;
								// if (Math.hypot(nextX - x1, nextY - y1) >= distance) break;
								// ctx.lineTo(nextX, nextY);
								// currentX = nextX;
								// currentY = nextY;
							// }
							// ctx.lineTo(x2, y2);
							// ctx.stroke();
						// },
						drawLightningArc(where, radius, lineWidth = 10, isCoolColors = true, strokeColor = null, shadowColor = null, shadowBlur = null) {
							const numPoints = 16;
							const slice = (2 * Math.PI) / numPoints;
							ctx.save()
							ctx.beginPath();
							//ctx.setLineDash([125 * Math.random(), 125 * Math.random()]);
							ctx.lineWidth = lineWidth;
							//ctx.arc(where.x, where.y, radius, 0, 2 * Math.PI);
							ctx.lineJoin = "miter"
							ctx.miterLimit = 100;
							if(isCoolColors) {
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
							//ctx.setLineDash([]);
							ctx.restore()
						}
					})
				}
				
				if (m.isHolding) {
                    m.drawHold(m.holdingTarget);
                    m.holding();
                    m.throwBlock();
                } else if ((input.field && m.fieldCDcycle < m.cycle)) {
                    if (m.energy > m.fieldRegen) m.energy -= m.fieldRegen
                    m.grabPowerUp();
                    m.lookForPickUp();
                } else if (m.holdingTarget && m.fieldCDcycle < m.cycle) {
                    m.pickUp();
                } else {
                    m.holdingTarget = null;
                }
				m.drawRegenEnergy()
			}
		},
	}
	m.fieldUpgrades.push(e);
	const fieldArray = m.fieldUpgrades.filter(
	(obj, index, self) =>
		index === self.findIndex((item) => item.name === obj.name)
	);
	m.fieldUpgrades = fieldArray;
})();
