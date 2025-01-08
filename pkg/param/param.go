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
	"ANTHROPIC_API_KEY":  "/chartsmith/anthropic_api_key",
	"VOYAGE_API_KEY":     "/chartsmith/voyage_api_key",
	"PG_URI":             "/chartsmith/pg_uri",
	"CENTRIFUGO_ADDRESS": "/chartsmith/centrifugo_address",
	"CENTRIFUGO_API_KEY": "/chartsmith/centrifugo_api_key",
	"TOKEN_ENCRYPTION":   "/chartsmith/token_encryption",
}

type Params struct {
	AnthropicAPIKey   string
	VoyageAPIKey      string
	PGURI             string
	CentrifugoAddress string
	CentrifugoAPIKey  string
	TokenEncryption   string
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
	if os.Getenv("USE_EC2_PARAMETERS") != "" {
		p, err := GetParamsFromSSM(paramLookup)
		if err != nil {
			return fmt.Errorf("get from ssm: %w", err)
		}
		paramsMap = p
	} else {
		paramsMap = GetParamsFromEnv(paramLookup)
	}

	params = &Params{
		AnthropicAPIKey:   paramsMap["ANTHROPIC_API_KEY"],
		VoyageAPIKey:      paramsMap["VOYAGE_API_KEY"],
		PGURI:             paramsMap["PG_URI"],
		CentrifugoAddress: paramsMap["CENTRIFUGO_ADDRESS"],
		CentrifugoAPIKey:  paramsMap["CENTRIFUGO_API_KEY"],
		TokenEncryption:   paramsMap["TOKEN_ENCRYPTION"],
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
