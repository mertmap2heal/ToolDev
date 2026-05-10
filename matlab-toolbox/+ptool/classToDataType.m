function dt = classToDataType(matlabClass)
    %CLASSTODATATYPE Map a MATLAB class to the project's parameter dataType.
    arguments
        matlabClass (1,:) char
    end
    switch matlabClass
        case {'double', 'single'}
            dt = 'float';
        case {'int8','int16','int32','int64','uint8','uint16','uint32','uint64'}
            dt = matlabClass;
        case 'logical'
            dt = 'bool';
        case {'char', 'string'}
            dt = 'string';
        case 'struct'
            dt = 'json';
        otherwise
            dt = 'string';
    end
end
