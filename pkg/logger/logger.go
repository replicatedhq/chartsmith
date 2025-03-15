package logger

import (
	"fmt"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/buffer"
	"go.uber.org/zap/zapcore"
)

var log *zap.Logger
var atom zap.AtomicLevel

// Create a buffer pool for our encoder
var bufferPool = buffer.NewPool()

func init() {
	atom = zap.NewAtomicLevel()
	atom.SetLevel(zapcore.DebugLevel)

	encoderCfg := zapcore.EncoderConfig{
		MessageKey:       "msg",
		LevelKey:         "lvl",
		NameKey:          zapcore.OmitKey,
		TimeKey:          "time", // Enable timestamp
		CallerKey:        zapcore.OmitKey,
		FunctionKey:      zapcore.OmitKey,
		StacktraceKey:    zapcore.OmitKey,
		LineEnding:       zapcore.DefaultLineEnding,
		EncodeLevel:      zapcore.CapitalLevelEncoder,
		EncodeTime:       zapcore.ISO8601TimeEncoder, // ISO8601 format with milliseconds
		EncodeName:       zapcore.FullNameEncoder,
		EncodeDuration:   zapcore.StringDurationEncoder,
		ConsoleSeparator: " ",
	}

	core := zapcore.NewCore(
		NewKVEncoder(encoderCfg),
		zapcore.AddSync(os.Stdout),
		atom,
	)

	log = zap.New(core)
}

type kvEncoder struct {
	zapcore.Encoder
	*zapcore.EncoderConfig
}

func NewKVEncoder(cfg zapcore.EncoderConfig) zapcore.Encoder {
	return &kvEncoder{
		Encoder:       zapcore.NewConsoleEncoder(cfg),
		EncoderConfig: &cfg,
	}
}

func (e *kvEncoder) EncodeEntry(ent zapcore.Entry, fields []zapcore.Field) (*buffer.Buffer, error) {
	line := bufferPool.Get()

	// Format time manually since we can't use EncodeTime directly with buffer
	formattedTime := ent.Time.Format("2006-01-02T15:04:05.000Z07:00") // ISO8601 format
	line.AppendString(formattedTime)
	line.AppendString(" ")

	line.AppendString(ent.Level.CapitalString())
	line.AppendString("    ")

	if ent.Message != "" {
		line.AppendString(ent.Message)
		line.AppendString("  ")
	}

	for i, f := range fields {
		if i > 0 {
			line.AppendString(" ")
		}
		line.AppendString(f.Key)
		line.AppendString("=")

		switch f.Type {
		case zapcore.StringType:
			line.AppendString(f.String)
		case zapcore.BoolType:
			if f.Integer == 1 {
				line.AppendString("true")
			} else {
				line.AppendString("false")
			}
		case zapcore.Int64Type, zapcore.Int32Type, zapcore.Int16Type, zapcore.Int8Type:
			line.AppendString(fmt.Sprint(f.Integer))
		default:
			line.AppendString(fmt.Sprint(f.Interface))
		}
	}

	line.AppendString("\n")

	return line, nil
}

func SetDebug() {
	atom.SetLevel(zapcore.DebugLevel)
}

func GetLogger() *zap.Logger {
	return log
}

func Error(err error, fields ...zap.Field) {
	allFields := append([]zap.Field{zap.Error(err)}, fields...)
	log.Error("error", allFields...)
}

func Errorf(template string, args ...interface{}) {
	log.Sugar().Errorf(template, args...)
}

func Warn(msg string, fields ...zap.Field) {
	log.Warn(msg, fields...)
}

func Warnf(template string, args ...interface{}) {
	log.Sugar().Warnf(template, args...)
}

func Info(msg string, fields ...zap.Field) {
	log.Info(msg, fields...)
}

func Infof(template string, args ...interface{}) {
	log.Sugar().Infof(template, args...)
}

func Debug(msg string, fields ...zap.Field) {
	log.Debug(msg, fields...)
}

func Debugf(template string, args ...interface{}) {
	log.Sugar().Debugf(template, args...)
}

// Any creates a zap.Field for any value
func Any(key string, value interface{}) zap.Field {
	return zap.Any(key, value)
}

// Err creates a zap.Field for an error
func Err(err error) zap.Field {
	return zap.Error(err)
}
