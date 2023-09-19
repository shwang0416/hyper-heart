const throttle = require('lodash.throttle')

const PALE_PINK = [255, 168, 213]
const BLUE = [66, 135, 245]
const GREEN = [105, 255, 117]
const YELLOW = [255, 233, 69]
const VIOLET = [177, 135, 255]
const COLORS = [PALE_PINK, BLUE, GREEN, YELLOW, VIOLET]

const MAX_PARTICLES = 500
const PARTICLE_ALPHA_FADEOUT = 0.97
const PARTICLE_ALPHA_MIN_THRESHOLD = 0.1

// The portions of this code dealing with the particle simulation are heavily based on:
// - https://atom.io/packages/power-mode
// - https://github.com/itszero/rage-power/blob/master/index.jsx
exports.decorateTerm = (Term, { React, notify }) => {
	return class extends React.Component {
		constructor(props, context) {
			super(props, context)

			this._drawFrame = this._drawFrame.bind(this)
			this._resizeCanvas = this._resizeCanvas.bind(this)
			this._onDecorated = this._onDecorated.bind(this)
			this._onCursorMove = this._onCursorMove.bind(this)
			this._spawnParticles = throttle(
				this._spawnParticles.bind(this),
				25,
				{ trailing: false }
			)
			this._heartSpiralParticles = []
			this.heartMatrix = [
				'01100110',
				'11111111',
				'11111111',
				'01111110',
				'00111100',
				'00011000',
			]
			this.heartMatrix2 = [
				'001100001100',
				'011110011110',
				'111111111111',
				'011111111110',
				'001111111100',
				'000111111100',
				'000011111000',
				'000001110000',
				'000000100000',
			]
			this.heartMatrix3 = [
				'0000110000110000',
				'0011111001111100',
				'1111111111111111',
				'1111111111111111',
				'0111111111111110',
				'0001111111111100',
				'0000011111110000',
				'0000001111100000',
				'0000000111000000',
				'0000000010000000',
			]

			this._div = null
			this._canvas = null
		}

		_onDecorated(term) {
			if (this.props.onDecorated) this.props.onDecorated(term)
			this._div = term ? term.termRef : null
			this._initCanvas()
		}

		_initCanvas() {
			this._canvas = document.createElement('canvas')
			this._canvas.style.position = 'absolute'
			this._canvas.style.top = '0'
			this._canvas.style.pointerEvents = 'none'
			this._canvasContext = this._canvas.getContext('2d')
			this._canvas.width = window.innerWidth
			this._canvas.height = window.innerHeight
			document.body.appendChild(this._canvas)
			window.requestAnimationFrame(this._drawFrame)
			window.addEventListener('resize', this._resizeCanvas)
		}

		_resizeCanvas() {
			this._canvas.width = window.innerWidth
			this._canvas.height = window.innerHeight
		}

		_drawFrame() {
			this._heartSpiralParticles.length &&
				this._canvasContext.clearRect(
					0,
					0,
					this._canvas.width,
					this._canvas.height
				)

			this._heartSpiralParticles.forEach((particle) => {
				particle.radius += 0.4
				particle.angle += 0.1
				particle.alpha *= PARTICLE_ALPHA_FADEOUT

				if (particle.alpha > PARTICLE_ALPHA_MIN_THRESHOLD) {
					// drawing one heart

					this._canvasContext.fillStyle = `rgba(${particle.color.join(
						','
					)}, ${particle.alpha})`

					const matrix =
						particle.size === 0
							? this.heartMatrix
							: particle.size === 1
							? this.heartMatrix2
							: this.heartMatrix3

					for (let i = 0; i < matrix.length; i++) {
						for (let j = 0; j < matrix[i].length; j++) {
							const arrow = matrix[i][j]
							if (arrow !== '0') {
								this._canvasContext.fillRect(
									j +
										particle.x +
										particle.radius *
											Math.cos(particle.angle),
									i +
										particle.y +
										particle.radius *
											Math.sin(particle.angle),
									1,
									1
								)
							}
						}
					}
				}
			})

			this._heartSpiralParticles = this._heartSpiralParticles
				.slice(
					Math.max(
						this._heartSpiralParticles.length - MAX_PARTICLES,
						0
					)
				)
				.filter(
					(particle) => particle.alpha > PARTICLE_ALPHA_MIN_THRESHOLD
				)
			if (
				this._heartSpiralParticles.length > 0 ||
				this.props.needsRedraw
			) {
				window.requestAnimationFrame(this._drawFrame)
			}
			this.props.needsRedraw = this._heartSpiralParticles.length === 0
		}
		_generateRandomNumber() {
			const randomNumber = Math.random()
			if (randomNumber < 0.25) {
				return 1
			} else if (randomNumber > 0.9) {
				return 2
			} else {
				return 0
			}
		}
		_spawnParticles(x, y) {
			const length = this._heartSpiralParticles.length

			const randomColorIndex = Math.floor(Math.random() * COLORS.length)
			const size = this._generateRandomNumber()
			this._heartSpiralParticles.push(
				this._createSpiralParticle(x, y, size, COLORS[randomColorIndex])
			)

			if (length === 0) {
				window.requestAnimationFrame(this._drawFrame)
			}
		}

		_createSpiralParticle(x, y, size, color) {
			return {
				x,
				y,
				size,
				alpha: 1,
				color,
				radius: 30,
				angle: Math.PI,
			}
		}
		_onCursorMove(cursorFrame) {
			if (this.props.onCursorMove) this.props.onCursorMove(cursorFrame)

			const { x, y } = cursorFrame
			requestAnimationFrame(() => {
				this._spawnParticles(x + 20, y + 50)
			})
		}

		render() {
			return React.createElement(
				Term,
				Object.assign({}, this.props, {
					onDecorated: this._onDecorated,
					onCursorMove: this._onCursorMove,
				})
			)
		}

		componentWillUnmount() {
			document.body.removeChild(this._canvas)
		}
	}
}
