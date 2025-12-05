package param

import (
	"fmt"
	"log"
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ssm"
)

var params *Params
var awsSession *session.Session

var paramLookup = map[string]string{
	"GROQ_API_KEY":                  "/chartsmith/groq_api_key",
	"VOYAGE_API_KEY":                "/chartsmith/voyage_api_key",
	"CHARTSMITH_PG_URI":             "/chartsmith/pg_uri",
	"CHARTSMITH_CENTRIFUGO_ADDRESS": "/chartsmith/centrifugo_address",
	"CHARTSMITH_CENTRIFUGO_API_KEY": "/chartsmith/centrifugo_api_key",
	"CHARTSMITH_TOKEN_ENCRYPTION":   "/chartsmith/token_encryption",
	"CHARTSMITH_SLACK_TOKEN":        "/chartsmith/slack_token",
	"CHARTSMITH_SLACK_CHANNEL":      "/chartsmith/slack_channel",
}

type Params struct {
	GroqAPIKey        string
	VoyageAPIKey      string
	PGURI             string
	CentrifugoAddress string
	CentrifugoAPIKey  string
	TokenEncryption   string
	SlackToken        string
	SlackChannel      string
}

func Get() Params {
	if params == nil {
		panic("params not initialized")
	}
	return *params
}

func Init(sess *session.Session) error {
	awsSession = sess

	var paramsMap map[string]string
	if os.Getenv("USE_EC2_PARAMETERS") == "true" {
		p, err := GetParamsFromSSM(paramLookup)
		if err != nil {
			return fmt.Errorf("get from ssm: %w", err)
		}
		paramsMap = p
	} else {
		paramsMap = GetParamsFromEnv(paramLookup)
	}

	params = &Params{
		GroqAPIKey:        paramsMap["GROQ_API_KEY"],
		VoyageAPIKey:      paramsMap["VOYAGE_API_KEY"],
		PGURI:             paramsMap["CHARTSMITH_PG_URI"],
		CentrifugoAddress: paramsMap["CHARTSMITH_CENTRIFUGO_ADDRESS"],
		CentrifugoAPIKey:  paramsMap["CHARTSMITH_CENTRIFUGO_API_KEY"],
		TokenEncryption:   paramsMap["CHARTSMITH_TOKEN_ENCRYPTION"],
		SlackToken:        paramsMap["CHARTSMITH_SLACK_TOKEN"],
		SlackChannel:      paramsMap["CHARTSMITH_SLACK_CHANNEL"],
	}

	return nil
}

func GetParamsFromSSM(paramLookup map[string]string) (map[string]string, error) {
	svc := ssm.New(awsSession)

	params := map[string]string{}
	reverseLookup := map[string][]string{}

	lookup := []*string{}
	for envName, ssmName := range paramLookup {
		if ssmName == "" {
			params[envName] = os.Getenv(envName)
			continue
		}

		lookup = append(lookup, aws.String(ssmName))
		if _, ok := reverseLookup[ssmName]; !ok {
			reverseLookup[ssmName] = []string{}
		}
		reverseLookup[ssmName] = append(reverseLookup[ssmName], envName)
	}
	batch := chunkSlice(lookup, 10)

	for _, names := range batch {
		input := &ssm.GetParametersInput{
			Names:          names,
			WithDecryption: aws.Bool(true),
		}
		output, err := svc.GetParameters(input)
		if err != nil {
			return params, fmt.Errorf("call get parameters: %w", err)
		}

		for _, p := range output.InvalidParameters {
			log.Printf("Ssm param %s invalid", *p)
		}

		for _, p := range output.Parameters {
			for _, envName := range reverseLookup[*p.Name] {
				params[envName] = *p.Value
			}
		}
	}

	return params, nil
}

func GetParamsFromEnv(paramLookup map[string]string) map[string]string {
	params := map[string]string{}
	for envName := range paramLookup {
		params[envName] = os.Getenv(envName)
	}
	return params
}

func chunkSlice(s []*string, n int) [][]*string {
	var chunked [][]*string
	for i := 0; i < len(s); i += n {
		end := i + n
		if end > len(s) {
			end = len(s)
		}
		chunked = append(chunked, s[i:end])
	}
	return chunked
}
