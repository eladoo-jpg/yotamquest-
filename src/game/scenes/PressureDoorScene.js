import Phaser from 'phaser';

export default class PressureDoorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PressureDoorScene' });
  }

  preload() {
    this.load.json('pressureDoorContent', 'data/events/pressure-door.json');
    this.load.image('pixel', 'assets/ui/pixel.png');
  }

  create() {
    const data = this.cache.json.get('pressureDoorContent');
    if (!data?.sentences?.length) {
      this.game.events.emit('eventComplete', {
        eventId: 'unknown', result: 'abandoned', attemptsUsed: 0, timeMs: 0,
      });
      this.scene.stop();
      return;
    }
    this.eventData = data;
    this.eventId = this.scene.settings.data?.eventId || data.eventId;

    // Pixel texture fallback for particles (if PNG not present)
    if (!this.textures.exists('pixel')) {
      const canvas = this.textures.createCanvas('pixel', 4, 4);
      canvas.context.fillStyle = '#ffffff';
      canvas.context.fillRect(0, 0, 4, 4);
      canvas.refresh();
    }

    // Animated laser wall
    this.buildAnimatedLaserWall();

    // Game state
    this.currentSentenceIndex = 0;
    this.attemptsUsed = 0;
    this.startTime = Date.now();
    this.roundTimer = null;
    this._correctBtn = null;

    // Timer countdown text
    this.timerText = this.add.text(240, 100, '', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    // Sentence text
    this.sentenceText = this.add.text(240, 350, '', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    if (typeof this.sentenceText.setRTL === 'function') {
      this.sentenceText.setRTL(true);
    }

    // Attempt counter
    this.attemptText = this.add.text(240, 480, '', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    // Buttons
    this.leftBtn = this.add.rectangle(120, 550, 160, 60, 0x1a1a2e)
      .setStrokeStyle(2, 0x00ffff)
      .setInteractive();
    this.leftBtnText = this.add.text(120, 550, '', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    this.rightBtn = this.add.rectangle(360, 550, 160, 60, 0x1a1a2e)
      .setStrokeStyle(2, 0x00ffff)
      .setInteractive();
    this.rightBtnText = this.add.text(360, 550, '', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    this.buildRound();
  }

  buildAnimatedLaserWall() {
    if (this.laserGraphics) { this.laserGraphics.destroy(); this.laserGraphics = null; }
    this.laserLines = [];
    const yPositions = [200, 206, 212];
    const durations  = [800, 950, 1100];
    this.laserColorTimer = this.time.addEvent({
      delay: 100,
      repeat: -1,
      callback: () => {
        const t = (Math.sin(Date.now() / 400) + 1) / 2;
        const r = 0xff, g = Math.floor(0x22 + t * (0x66 - 0x22)), b = 0x22;
        const color = (r << 16) | (g << 8) | b;
        this.laserLines.forEach(line => {
          line.clear();
          line.fillStyle(color, 1);
          line.fillRect(0, 0, 480, 2);
        });
      },
    });
    yPositions.forEach((y, i) => {
      const line = this.add.graphics().setDepth(10);
      line.fillStyle(0xff2222, 1);
      line.fillRect(0, 0, 480, 2);
      line.setPosition(0, y);
      this.tweens.add({
        targets: line,
        alpha: { from: 0.6, to: 1.0 },
        duration: durations[i],
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.laserLines.push(line);
    });
  }

  buildRound() {
    const sentence = this.eventData.sentences[this.currentSentenceIndex];
    const words = sentence.hebrew.split(' ');
    const correctWord = words[sentence.correctWordIndex];
    const distractorWord = sentence.distractorWord;

    this.sentenceText.setText(sentence.hebrew);
    this.attemptText.setText(`ניסיון ${this.attemptsUsed + 1} מתוך ${this.eventData.maxAttempts}`);

    // Randomize correct button side
    const correctOnLeft = Math.random() < 0.5;
    this.leftBtn.removeAllListeners();
    this.rightBtn.removeAllListeners();
    // Reset button colors
    this.leftBtn.setFillStyle(0x1a1a2e);
    this.rightBtn.setFillStyle(0x1a1a2e);

    if (correctOnLeft) {
      this._correctBtn = this.leftBtn;
      this.leftBtnText.setText(correctWord);
      this.rightBtnText.setText(distractorWord);
      this.leftBtn.on('pointerdown', () => this.onCorrect());
      this.rightBtn.on('pointerdown', () => this.onWrong());
    } else {
      this._correctBtn = this.rightBtn;
      this.leftBtnText.setText(distractorWord);
      this.rightBtnText.setText(correctWord);
      this.leftBtn.on('pointerdown', () => this.onWrong());
      this.rightBtn.on('pointerdown', () => this.onCorrect());
    }

    // Reset timer
    if (this.roundTimer) {
      this.roundTimer.remove(false);
      this.roundTimer = null;
    }

    if (this.eventData.timeoutSeconds > 0) {
      this.secondsLeft = this.eventData.timeoutSeconds;
      this.timerText.setText(`${this.secondsLeft}`);
      this.roundTimer = this.time.addEvent({
        delay: 1000,
        repeat: this.eventData.timeoutSeconds - 1,
        callback: this.onTimerTick,
        callbackScope: this,
      });
    } else {
      this.timerText.setText('');
    }
  }

  onTimerTick() {
    this.secondsLeft--;
    this.timerText.setText(`${this.secondsLeft}`);
    if (this.secondsLeft <= 0) {
      this.onWrong();
    }
  }

  onCorrect() {
    this.playSfx('correct_answer');
    if (this.roundTimer) { this.roundTimer.remove(false); this.roundTimer = null; }
    const btn = this._correctBtn;
    if (btn) {
      btn.setFillStyle(0x00ff88);
      this.time.delayedCall(150, () => btn.setFillStyle(0x1a1a2e));
    }
    this.currentSentenceIndex++;
    if (this.currentSentenceIndex >= this.eventData.sentences.length) {
      this.handleSuccess();
    } else {
      this.buildRound();
    }
  }

  onWrong() {
    this.cameras.main.shake(200, 0.008);
    this.playSfx('wrong_answer');
    if (this.roundTimer) { this.roundTimer.remove(false); this.roundTimer = null; }
    this.attemptsUsed++;
    if (this.attemptsUsed >= this.eventData.maxAttempts) {
      this.handleFailure();
    } else {
      this.currentSentenceIndex = 0;
      this.buildRound();
    }
  }

  handleSuccess() {
    this.onEventComplete('success');
    this.game.events.emit('eventComplete', {
      eventId: this.eventId,
      result: 'success',
      attemptsUsed: this.attemptsUsed,
      timeMs: Date.now() - this.startTime,
    });
    this.playSfx('typing_success');
    this.playSuccessParticles();
    this.time.delayedCall(800, () => this.scene.stop());
  }

  handleFailure() {
    this.cameras.main.flash(300, 255, 0, 0, false);
    this.onEventComplete('failure');
    this.game.events.emit('eventComplete', {
      eventId: this.eventId,
      result: 'failure',
      attemptsUsed: this.attemptsUsed,
      timeMs: Date.now() - this.startTime,
    });
    this.scene.stop();
  }

  playSuccessParticles() {
    if (!this.textures.exists('pixel')) return;
    const emitter = this.add.particles(240, 400, 'pixel', {
      speed: { min: 80, max: 200 },
      scale: { min: 0.5, max: 1.5 },
      lifespan: 800,
      gravityY: 200,
      tint: [0x00ff88, 0xffff00, 0xff88ff],
      emitting: false,
    });
    emitter.explode(40);
  }

  playSfx(actionKey) {
    // Use global SfxManager if available (Stage 4); silent fallback if not yet loaded
    const sfxMgr = this.game?.sfxManager;
    if (sfxMgr) { sfxMgr.play(actionKey); }
  }

  onEventComplete(result) {
    // Integration seam for EventManager. Do not implement yet.
  }

  shutdown() {
    if (this.roundTimer) { this.roundTimer.remove(false); this.roundTimer = null; }
    if (this.laserColorTimer) { this.laserColorTimer.remove(); this.laserColorTimer = null; }
    this.laserLines?.forEach(l => l.destroy());
    this.laserLines = [];
    this.tweens.killAll();
    if (this.laserGraphics) { this.laserGraphics.destroy(); this.laserGraphics = null; }
  }
}
