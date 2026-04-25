classdef ptoolClient_test < matlab.unittest.TestCase
    %PTOOLCLIENT_TEST Smoke tests for the REST client value-mapping helpers.
    %
    %   Run with:
    %       results = runtests('tests')
    %
    %   These exercise the value-mapping helpers without hitting the
    %   network. Integration tests that talk to a running backend live
    %   in tests/integration/ and are guarded by an env var.

    methods (Test)
        function classToDataType_maps_numeric(tc)
            tc.verifyEqual(ptool.classToDataType('double'), 'float');
            tc.verifyEqual(ptool.classToDataType('uint16'), 'uint16');
        end

        function classToDataType_maps_logical(tc)
            tc.verifyEqual(ptool.classToDataType('logical'), 'bool');
        end

        function valueToString_roundtrips_scalar(tc)
            tc.verifyEqual(ptool.valueToString(28.5), '28.5');
            tc.verifyEqual(ptool.valueToString(true), 'true');
            tc.verifyEqual(ptool.valueToString(false), 'false');
        end

        function valueToString_serialises_vector_as_json(tc)
            s = ptool.valueToString([1 2 3]);
            tc.verifyTrue(startsWith(s, '['));
        end

        function stringToValue_parses_float(tc)
            tc.verifyEqual(ptool.stringToValue("28.5", "float"), 28.5);
        end

        function stringToValue_parses_bool(tc)
            tc.verifyTrue(ptool.stringToValue("true", "bool"));
            tc.verifyFalse(ptool.stringToValue("false", "bool"));
        end

        function stringToValue_typed_int(tc)
            v = ptool.stringToValue("12", "uint8");
            tc.verifyEqual(class(v), 'uint8');
            tc.verifyEqual(double(v), 12);
        end
    end
end
