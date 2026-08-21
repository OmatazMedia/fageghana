<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Certificate extends Model
{
    protected $table = 'certificates';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['user_id', 'member_id', 'certificate_number', 'title', 'description', 'issued_at', 'expires_at', 'status', 'issued_by', 'download_url', 'verification_code'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
