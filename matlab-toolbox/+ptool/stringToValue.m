function v = stringToValue(str, dataType)
    %STRINGTOVALUE Inverse of valueToString.
    arguments
        str      (1,1) string
        dataType (1,1) string
    end
    switch dataType
        case "float"
            v = str2double(str);
        case {"int8","int16","int32","int64","uint8","uint16","uint32","uint64"}
            v = cast(str2double(str), char(dataType));
        case "bool"
            v = (str == "true") | (str == "1");
        case "json"
            v = jsondecode(char(str));
        otherwise
            v = char(str);
    end
end
